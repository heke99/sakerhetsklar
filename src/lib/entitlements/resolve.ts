/**
 * Pure entitlement resolution (batch 15) — unit tested.
 *
 * Sources, in priority order:
 * 1. Tenant feature-flag override (`tenant_feature_flags`, prefix `ent:`) —
 *    explicit, reasoned, audited complimentary/internal access.
 * 2. Plan entitlement row (`entitlements` for the tenant's plan).
 * 3. FAIL CLOSED: unknown key or missing row → disabled / limit 0.
 */

export const ENTITLEMENT_KEYS = [
  "users",
  "legal_entities",
  "evidence_bank",
  "war_room",
  "gdpr_track",
  "integrations",
  "webhooks",
  "api_access",
  "exports",
  "advanced_reporting",
  "procurement_package",
  "supplier_risk",
  "leadership",
  "sso_saml",
  "scim",
  "break_glass",
  "ip_allowlist",
  "single_tenant",
  "customer_owned_data_plane",
] as const;
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export interface EntitlementRow {
  entitlement_key: string;
  enabled: boolean;
  limit_value: number | null;
}

export interface FlagOverride {
  flag_code: string;
  enabled: boolean;
}

export interface ResolvedEntitlement {
  enabled: boolean;
  /** null = unlimited (only meaningful when enabled). */
  limit: number | null;
  source: "override" | "plan" | "default";
}

export const OVERRIDE_PREFIX = "ent:";

export function resolveEntitlement(
  key: EntitlementKey,
  planRows: EntitlementRow[],
  overrides: FlagOverride[],
): ResolvedEntitlement {
  const override = overrides.find((o) => o.flag_code === `${OVERRIDE_PREFIX}${key}`);
  if (override) {
    return { enabled: override.enabled, limit: null, source: "override" };
  }

  const row = planRows.find((r) => r.entitlement_key === key);
  if (row) {
    return { enabled: row.enabled, limit: row.limit_value, source: "plan" };
  }

  // Fail closed: what is not granted does not exist.
  return { enabled: false, limit: 0, source: "default" };
}
