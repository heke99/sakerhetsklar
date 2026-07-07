import "server-only";

import { getAdminClient } from "@/lib/server/supabase-admin";
import { env } from "@/lib/server/env";

import { resolveFromRegistry } from "./resolve";
import type { DomainRegistryRow, ResolutionResult } from "./types";

/**
 * Small TTL cache of SAFE (non-secret) registry rows only. Never cache secret
 * references or service keys here.
 */
const cache = new Map<string, { row: DomainRegistryRow | null; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export function clearResolverCache(): void {
  cache.clear();
}

async function loadRegistryRow(host: string): Promise<DomainRegistryRow | null> {
  const cached = cache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.row;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenant_domains")
    .select(
      `domain, environment, status,
       tenants:tenant_id (
         id, status, deployment_model,
         tenant_modules (module_code, enabled),
         tenant_auth_providers (provider_type, status),
         tenant_data_plane_connections (status, supabase_url, publishable_key, api_base_url, environment)
       )`,
    )
    .eq("domain", host)
    .maybeSingle();

  if (error || !data) {
    cache.set(host, { row: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  type TenantJoin = {
    id: string;
    status: string;
    deployment_model: string;
    tenant_modules: { module_code: string; enabled: boolean }[];
    tenant_auth_providers: { provider_type: string; status: string }[];
    tenant_data_plane_connections: {
      status: string;
      supabase_url: string | null;
      publishable_key: string | null;
      api_base_url: string | null;
      environment: string;
    }[];
  };
  const tenant = data.tenants as unknown as TenantJoin | null;
  if (!tenant) return null;

  const activeProvider = tenant.tenant_auth_providers.find((p) => p.status === "active");
  const plane =
    tenant.tenant_data_plane_connections.find(
      (c) => c.environment === data.environment,
    ) ?? tenant.tenant_data_plane_connections[0] ?? null;

  const row: DomainRegistryRow = {
    domain: data.domain,
    tenantId: tenant.id,
    environment: data.environment as DomainRegistryRow["environment"],
    domainStatus: data.status as DomainRegistryRow["domainStatus"],
    tenantStatus: tenant.status as DomainRegistryRow["tenantStatus"],
    deploymentModel: tenant.deployment_model as DomainRegistryRow["deploymentModel"],
    enabledModules: tenant.tenant_modules
      .filter((m) => m.enabled)
      .map((m) => m.module_code),
    authProviderType: activeProvider?.provider_type ?? null,
    dataPlane: plane
      ? {
          status: plane.status as NonNullable<DomainRegistryRow["dataPlane"]>["status"],
          supabaseUrl: plane.supabase_url,
          publishableKey: plane.publishable_key,
          apiBaseUrl: plane.api_base_url,
          environment: plane.environment as DomainRegistryRow["environment"],
        }
      : null,
  };

  cache.set(host, { row, expiresAt: Date.now() + CACHE_TTL_MS });
  return row;
}

/**
 * Resolves the tenant configuration for an incoming host. Fails closed for
 * unknown domains. The primary app hosts (Model A) resolve without a domain
 * registry entry.
 */
export async function resolveTenantByHost(rawHost: string | null): Promise<ResolutionResult> {
  const sharedDataPlane = {
    supabaseUrl: env.supabaseUrl,
    publishableKey: env.supabaseAnonKey,
    apiBaseUrl: "/api/v1",
  };

  const host = rawHost?.trim().toLowerCase() ?? "";
  if (env.appPrimaryHosts.includes(host)) {
    return {
      ok: true,
      config: {
        tenantId: "",
        environment: "prod",
        deploymentModel: "multi_tenant",
        enabledModules: [],
        authProviderType: "email_password",
        ...sharedDataPlane,
      },
    };
  }

  const row = await loadRegistryRow(host);
  const registry = new Map<string, DomainRegistryRow>();
  if (row) registry.set(row.domain, row);

  return resolveFromRegistry(host, registry, sharedDataPlane);
}
