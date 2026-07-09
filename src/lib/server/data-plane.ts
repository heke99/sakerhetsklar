import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient, getDataPlaneClient } from "./supabase-admin";

/**
 * Data-plane abstraction for deployment models A/B/C.
 *
 * - Model A (`multi_tenant`): shared application database with RLS +
 *   service-layer tenant isolation. The central admin client is the data
 *   plane.
 * - Model B (`single_tenant`): separate Supabase project per customer,
 *   operated by Säkerhetsklar.
 * - Model C (`customer_owned`): customer-owned data plane.
 *
 * FAIL-CLOSED INVARIANT: a tenant configured as Model B/C whose data plane is
 * not fully provisioned (active connection + resolvable server-side secret)
 * must not be able to read or write ANY tenant data — neither in an isolated
 * plane nor accidentally in the central database. This module is the single
 * source of truth for that decision; `getActorContext` additionally drops
 * memberships of non-ready B/C tenants so every API route and page denies
 * access until provisioning completes.
 */

export type DeploymentModel = "multi_tenant" | "single_tenant" | "customer_owned";

export class DataPlaneNotReadyError extends Error {
  constructor(
    public tenantId: string,
    public reason: string,
  ) {
    super(`Data plane for tenant ${tenantId} is not ready: ${reason}`);
    this.name = "DataPlaneNotReadyError";
  }
}

interface PlaneState {
  model: DeploymentModel;
  ready: boolean;
  reason?: string;
  connection?: { url: string; serviceRoleKeyRef: string };
}

// Short TTL cache: deployment model changes are rare; avoids an extra
// round-trip on every service call.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { state: PlaneState; expiresAt: number }>();

/** Invalidate cache (used by tests and after deployment-model changes). */
export function invalidateDataPlaneCache(tenantId?: string): void {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

/** The control-plane client (registry, identity, billing — always central). */
export function getTenantControlPlaneClient(): SupabaseClient {
  return getAdminClient();
}

async function loadPlaneState(tenantId: string): Promise<PlaneState> {
  const control = getAdminClient();

  const { data: tenant, error } = await control
    .from("tenants")
    .select("deployment_model")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) {
    return { model: "multi_tenant", ready: false, reason: "tenant_not_found" };
  }

  const model = (tenant.deployment_model ?? "multi_tenant") as DeploymentModel;
  if (model === "multi_tenant") {
    return { model, ready: true };
  }

  const { data: connection } = await control
    .from("tenant_data_plane_connections")
    .select("supabase_url, service_role_key_ref, status")
    .eq("tenant_id", tenantId)
    .eq("environment", "prod")
    .maybeSingle();

  if (!connection) {
    return { model, ready: false, reason: "no_data_plane_connection" };
  }
  if (connection.status !== "active") {
    return { model, ready: false, reason: `connection_${connection.status}` };
  }
  if (!connection.supabase_url || !connection.service_role_key_ref) {
    return { model, ready: false, reason: "connection_incomplete" };
  }
  if (!process.env[connection.service_role_key_ref]) {
    return { model, ready: false, reason: "secret_not_configured" };
  }

  return {
    model,
    ready: true,
    connection: {
      url: connection.supabase_url,
      serviceRoleKeyRef: connection.service_role_key_ref,
    },
  };
}

async function getPlaneState(tenantId: string): Promise<PlaneState> {
  const now = Date.now();
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > now) return cached.state;

  const state = await loadPlaneState(tenantId);
  cache.set(tenantId, { state, expiresAt: now + CACHE_TTL_MS });
  return state;
}

/** Resolves the tenant's deployment model (A/B/C). */
export async function resolveTenantDeploymentModel(
  tenantId: string,
): Promise<DeploymentModel> {
  return (await getPlaneState(tenantId)).model;
}

/**
 * Readiness check for health endpoints and admin UI. Never throws for
 * not-ready planes — returns the reason instead.
 */
export async function assertDataPlaneReady(tenantId: string): Promise<{
  model: DeploymentModel;
  ready: boolean;
  reason?: string;
}> {
  const state = await getPlaneState(tenantId);
  return { model: state.model, ready: state.ready, reason: state.reason };
}

/**
 * Returns the Supabase client for the tenant's data plane.
 *
 * - Model A → central tenant-aware admin client.
 * - Model B/C with a fully provisioned connection → isolated plane client.
 * - Model B/C otherwise → throws (fail closed). There is NO fallback to the
 *   central database.
 */
export async function getTenantDataPlaneClient(
  tenantId: string,
): Promise<SupabaseClient> {
  const state = await getPlaneState(tenantId);

  if (state.model === "multi_tenant") {
    if (!state.ready) {
      throw new DataPlaneNotReadyError(tenantId, state.reason ?? "unknown");
    }
    return getAdminClient();
  }

  if (!state.ready || !state.connection) {
    throw new DataPlaneNotReadyError(tenantId, state.reason ?? "unknown");
  }
  return getDataPlaneClient(state.connection);
}

/**
 * Set of tenant ids from `candidates` whose data plane is NOT ready. Used by
 * the actor context to drop memberships of unprovisioned B/C tenants so all
 * authorization checks fail closed for them.
 */
export async function filterTenantsWithUnreadyDataPlane(
  candidates: string[],
): Promise<Set<string>> {
  const unready = new Set<string>();
  await Promise.all(
    candidates.map(async (tenantId) => {
      const state = await getPlaneState(tenantId);
      if (!state.ready) unready.add(tenantId);
    }),
  );
  return unready;
}
