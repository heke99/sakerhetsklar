import { withApi, ok, forbidden, notFound } from "@/lib/api/handler";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  // Anomaly telemetry is control-plane security monitoring data.
  const admin = getAdminClient();

  if (tenantId) {
    if (
      !hasTenantRole(actor, tenantId, ["tenant_admin", "ciso", "dpo"]) &&
      !hasPlatformRole(actor, ["platform_owner", "security_admin", "readonly_auditor"])
    ) {
      throw forbidden();
    }
    const [securityRes, privacyRes, casesRes] = await Promise.all([
      admin
        .from("security_anomaly_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("detected_at", { ascending: false })
        .limit(100),
      admin
        .from("privacy_anomaly_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("detected_at", { ascending: false })
        .limit(100),
      admin
        .from("anomaly_review_cases")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    return ok({
      security: securityRes.data ?? [],
      privacy: privacyRes.data ?? [],
      cases: casesRes.data ?? [],
    });
  }

  if (!hasPlatformRole(actor, ["platform_owner", "security_admin", "readonly_auditor"])) {
    throw notFound("tenantId is required");
  }
  const [securityRes, casesRes] = await Promise.all([
    admin
      .from("security_anomaly_events")
      .select("*, tenants(name)")
      .order("detected_at", { ascending: false })
      .limit(200),
    admin
      .from("anomaly_review_cases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  return ok({ security: securityRes.data ?? [], cases: casesRes.data ?? [] });
});
