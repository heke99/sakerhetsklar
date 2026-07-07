import "server-only";

import { getAdminClient } from "@/lib/server/supabase-admin";

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  pausedTenants: number;
  trialTenants: number;
  enterpriseTenants: number;
  multiTenantCount: number;
  singleTenantCount: number;
  customerOwnedCount: number;
  onboardingNotStarted: number;
  onboardingInProgress: number;
  onboardingBlocked: number;
  onboardingComplete: number;
  tenantsMissingRuleProfile: number;
  tenantsWithActiveIncidents: number;
  tenantsWithPotentialSignificant: number;
  tenantsWithMissedDeadlines: number;
  activeSupportAccess: number;
  pendingSupportAccess: number;
  rulePackagesByStatus: Record<string, number>;
  healthByStatus: Record<string, number>;
  productionReadinessByStatus: Record<string, number>;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const admin = getAdminClient();

  const [tenantsRes, cpRes, supportRes, ruleSetsRes, rulePkgRes] = await Promise.all([
    admin
      .from("tenants")
      .select("id, status, plan, deployment_model, onboarding_status")
      .is("deleted_at", null),
    admin
      .from("control_plane_tenants")
      .select(
        "tenant_id, health_status, production_readiness, open_incident_count, potential_significant_incident_count, missed_deadline_count",
      ),
    admin.from("support_access_requests").select("id, status, expires_at"),
    admin.from("regulatory_rule_sets").select("code, status"),
    admin.from("tenant_rule_package_versions").select("tenant_id").eq("status", "active"),
  ]);

  const tenants = tenantsRes.data ?? [];
  const cp = cpRes.data ?? [];
  const support = supportRes.data ?? [];
  const ruleSets = ruleSetsRes.data ?? [];
  const tenantsWithRules = new Set((rulePkgRes.data ?? []).map((r) => r.tenant_id));

  const count = (fn: (t: (typeof tenants)[number]) => boolean) =>
    tenants.filter(fn).length;

  const rulePackagesByStatus: Record<string, number> = {};
  for (const rs of ruleSets) {
    rulePackagesByStatus[rs.status] = (rulePackagesByStatus[rs.status] ?? 0) + 1;
  }

  const healthByStatus: Record<string, number> = {};
  const productionReadinessByStatus: Record<string, number> = {};
  for (const row of cp) {
    healthByStatus[row.health_status] = (healthByStatus[row.health_status] ?? 0) + 1;
    productionReadinessByStatus[row.production_readiness] =
      (productionReadinessByStatus[row.production_readiness] ?? 0) + 1;
  }

  const now = Date.now();

  return {
    totalTenants: tenants.length,
    activeTenants: count((t) => t.status === "active"),
    pausedTenants: count((t) => t.status === "paused"),
    trialTenants: count((t) => t.plan === "starter"),
    enterpriseTenants: count((t) => t.plan === "enterprise"),
    multiTenantCount: count((t) => t.deployment_model === "multi_tenant"),
    singleTenantCount: count((t) => t.deployment_model === "single_tenant"),
    customerOwnedCount: count((t) => t.deployment_model === "customer_owned"),
    onboardingNotStarted: count((t) => t.onboarding_status === "not_started"),
    onboardingInProgress: count((t) => t.onboarding_status === "in_progress"),
    onboardingBlocked: count((t) => t.onboarding_status === "blocked"),
    onboardingComplete: count((t) => t.onboarding_status === "complete"),
    tenantsMissingRuleProfile: tenants.filter((t) => !tenantsWithRules.has(t.id)).length,
    tenantsWithActiveIncidents: cp.filter((r) => r.open_incident_count > 0).length,
    tenantsWithPotentialSignificant: cp.filter(
      (r) => r.potential_significant_incident_count > 0,
    ).length,
    tenantsWithMissedDeadlines: cp.filter((r) => r.missed_deadline_count > 0).length,
    activeSupportAccess: support.filter(
      (s) =>
        s.status === "approved" &&
        (!s.expires_at || new Date(s.expires_at).getTime() > now),
    ).length,
    pendingSupportAccess: support.filter((s) => s.status === "requested").length,
    rulePackagesByStatus,
    healthByStatus,
    productionReadinessByStatus,
  };
}
