import "server-only";

import { forbidden, notFound } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { hasPermission, isTenantMember, type ActorContext } from "./context";
import type { Permission } from "./roles";

/**
 * Reusable server-side tenant authorization guards.
 *
 * Rules enforced here:
 * - Tenant ownership of any client-supplied resource ID is always resolved
 *   server-side before it is used in a write.
 * - Cross-tenant references fail with 404 so the response never reveals
 *   whether the resource exists in another tenant.
 * - These guards complement (never replace) RLS and DB composite FKs.
 */

/**
 * Asserts that the actor is a member of the tenant (or has active support
 * access) and, when a permission is given, that the actor holds it there.
 * Throws 403 without revealing tenant existence details.
 */
export function assertTenantAccess(
  actor: ActorContext,
  tenantId: string,
  permission?: Permission,
): void {
  if (!isTenantMember(actor, tenantId)) {
    throw forbidden();
  }
  if (permission && !hasPermission(actor, tenantId, permission)) {
    throw forbidden(`${permission} permission required`);
  }
}

/**
 * Asserts that a row exists in `table` with the given id AND belongs to
 * `tenantId`. Throws 404 (never 403) on mismatch so cross-tenant probing
 * cannot distinguish "exists elsewhere" from "does not exist".
 */
export async function assertTenantEntity(
  table: string,
  id: string,
  tenantId: string,
  { idColumn = "id" }: { idColumn?: string } = {},
): Promise<void> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from(table)
    .select(idColumn)
    .eq(idColumn, id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFound("Resource not found");
}

/**
 * Asserts that every id in `ids` belongs to `tenantId` in `table`.
 * Duplicate ids are allowed; a single missing/cross-tenant id fails the call.
 */
export async function assertAllTenantEntities(
  table: string,
  ids: string[],
  tenantId: string,
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from(table)
    .select("id")
    .in("id", unique)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r) => r.id as string));
  if (unique.some((id) => !found.has(id))) {
    throw notFound("Resource not found");
  }
}

/**
 * Resolves the owning tenant of an entity server-side. Returns null when the
 * row does not exist. Use this instead of trusting tenant IDs from request
 * bodies when a resource ID is present.
 */
export async function resolveTenantFromEntity(
  table: string,
  id: string,
): Promise<string | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from(table)
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.tenant_id as string | undefined) ?? null;
}

/**
 * Resolves an entity's tenant, verifies it matches the optional expected
 * tenant, and asserts the actor may access it. Returns the resolved tenant id
 * (the authoritative one — never the client-supplied value).
 */
async function assertEntityTenantForActor(
  table: string,
  id: string,
  actor: ActorContext,
  expectedTenantId?: string,
  permission?: Permission,
): Promise<string> {
  const tenantId = await resolveTenantFromEntity(table, id);
  if (!tenantId) throw notFound("Resource not found");
  if (expectedTenantId && expectedTenantId !== tenantId) {
    throw notFound("Resource not found");
  }
  if (!isTenantMember(actor, tenantId)) {
    // Same status as non-existence: do not leak that the resource exists.
    throw notFound("Resource not found");
  }
  if (permission && !hasPermission(actor, tenantId, permission)) {
    throw forbidden(`${permission} permission required`);
  }
  return tenantId;
}

/** Asserts the incident belongs to the actor's tenant; returns its tenant id. */
export async function assertIncidentTenant(
  actor: ActorContext,
  incidentId: string,
  optionalTenantId?: string,
  permission?: Permission,
): Promise<string> {
  return assertEntityTenantForActor(
    "incidents",
    incidentId,
    actor,
    optionalTenantId,
    permission,
  );
}

/** Asserts the report belongs to the actor's tenant; returns its tenant id. */
export async function assertReportTenant(
  actor: ActorContext,
  reportId: string,
  optionalTenantId?: string,
  permission?: Permission,
): Promise<string> {
  return assertEntityTenantForActor(
    "incident_reports",
    reportId,
    actor,
    optionalTenantId,
    permission,
  );
}

/** Asserts the evidence belongs to the actor's tenant; returns its tenant id. */
export async function assertEvidenceTenant(
  actor: ActorContext,
  evidenceId: string,
  optionalTenantId?: string,
  permission?: Permission,
): Promise<string> {
  return assertEntityTenantForActor(
    "evidence",
    evidenceId,
    actor,
    optionalTenantId,
    permission,
  );
}
