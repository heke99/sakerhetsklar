import { withApi, ok, forbidden } from "@/lib/api/handler";
import { hasPlatformRole, hasPermission } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);
  const admin = getAdminClient();

  if (tenantId) {
    if (
      !hasPermission(actor, tenantId, "audit.read") &&
      !hasPlatformRole(actor, [
        "platform_owner",
        "platform_admin",
        "security_admin",
        "readonly_auditor",
      ])
    ) {
      throw forbidden();
    }
    const { data, error } = await admin
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return ok(data);
  }

  if (
    !hasPlatformRole(actor, [
      "platform_owner",
      "platform_admin",
      "security_admin",
      "readonly_auditor",
    ])
  ) {
    throw forbidden("Platform audit visibility requires a platform security role");
  }
  const { data, error } = await admin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ok(data);
});
