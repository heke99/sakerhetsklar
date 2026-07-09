import "server-only";

import { ApiError } from "@/lib/api/handler";
import {
  resolveEntitlement,
  type EntitlementKey,
  type EntitlementRow,
  type FlagOverride,
  type ResolvedEntitlement,
} from "@/lib/entitlements/resolve";
import { getAdminClient } from "@/lib/server/supabase-admin";

/**
 * Tenant entitlement service (batch 15). Plan rows + explicit per-tenant
 * overrides, fail closed. Backed by a short TTL cache; overrides/plan
 * changes take effect within 30 seconds (or immediately via invalidate).
 */

const CACHE_TTL_MS = 30_000;
const cache = new Map<
  string,
  { rows: EntitlementRow[]; overrides: FlagOverride[]; expiresAt: number }
>();

export function invalidateEntitlementsCache(tenantId?: string): void {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

async function loadEntitlements(tenantId: string): Promise<{
  rows: EntitlementRow[];
  overrides: FlagOverride[];
}> {
  const now = Date.now();
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > now) return cached;

  const admin = getAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .maybeSingle();
  const plan = (tenant?.plan as string | undefined) ?? "starter";

  const [rowsRes, overridesRes] = await Promise.all([
    admin
      .from("entitlements")
      .select("entitlement_key, enabled, limit_value")
      .eq("plan_code", plan),
    admin
      .from("tenant_feature_flags")
      .select("flag_code, enabled")
      .eq("tenant_id", tenantId)
      .like("flag_code", "ent:%"),
  ]);

  const entry = {
    rows: (rowsRes.data ?? []) as EntitlementRow[],
    overrides: (overridesRes.data ?? []) as FlagOverride[],
    expiresAt: now + CACHE_TTL_MS,
  };
  cache.set(tenantId, entry);
  return entry;
}

export async function getEntitlement(
  tenantId: string,
  key: EntitlementKey,
): Promise<ResolvedEntitlement> {
  const { rows, overrides } = await loadEntitlements(tenantId);
  return resolveEntitlement(key, rows, overrides);
}

export async function hasEntitlement(
  tenantId: string,
  key: EntitlementKey,
): Promise<boolean> {
  return (await getEntitlement(tenantId, key)).enabled;
}

/** Throws 403 `feature_not_in_plan` when the tenant lacks the entitlement. */
export async function assertEntitlement(
  tenantId: string,
  key: EntitlementKey,
): Promise<void> {
  if (!(await hasEntitlement(tenantId, key))) {
    throw new ApiError(
      403,
      "Funktionen ingår inte i er plan. Kontakta er administratör eller Säkerhetsklar för uppgradering.",
      "feature_not_in_plan",
    );
  }
}

/**
 * Enforces the user-count limit before adding a member/invitation.
 * Counts active members + pending invitations against the plan limit.
 */
export async function assertUserLimitNotReached(tenantId: string): Promise<void> {
  const entitlement = await getEntitlement(tenantId, "users");
  if (!entitlement.enabled) {
    throw new ApiError(403, "Användarhantering ingår inte i er plan.", "feature_not_in_plan");
  }
  if (entitlement.limit === null) return; // unlimited

  const admin = getAdminClient();
  const [membersRes, invitesRes] = await Promise.all([
    admin
      .from("tenant_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    admin
      .from("tenant_invitations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
  ]);
  const used = (membersRes.count ?? 0) + (invitesRes.count ?? 0);
  if (used >= entitlement.limit) {
    throw new ApiError(
      403,
      `Er plan tillåter högst ${entitlement.limit} användare (${used} används inkl. väntande inbjudningar).`,
      "user_limit_reached",
    );
  }
}
