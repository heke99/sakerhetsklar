import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { requestSupportAccess } from "@/lib/services/support-access";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const admin = getAdminClient();

  let query = admin
    .from("support_access_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (tenantId) {
    if (
      !hasTenantRole(actor, tenantId, ["tenant_admin", "ciso"]) &&
      !hasPlatformRole(actor, [
        "platform_owner",
        "platform_admin",
        "support_admin",
        "security_admin",
        "readonly_auditor",
      ])
    ) {
      throw forbidden();
    }
    query = query.eq("tenant_id", tenantId);
  } else if (
    !hasPlatformRole(actor, [
      "platform_owner",
      "platform_admin",
      "support_admin",
      "security_admin",
      "readonly_auditor",
    ])
  ) {
    // Non-platform users only see requests they must decide on.
    const adminTenants = [...actor.tenantRoles.entries()]
      .filter(([, roles]) => roles.includes("tenant_admin") || roles.includes("ciso"))
      .map(([id]) => id);
    if (adminTenants.length === 0) return ok([]);
    query = query.in("tenant_id", adminTenants);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ok(data);
});

const requestSchema = z.object({
  tenantId: z.string().uuid(),
  purpose: z.string().min(10).max(1000),
  scope: z.enum(["read_only", "read_write"]).default("read_only"),
  includeEvidence: z.boolean().default(false),
  allowExport: z.boolean().default(false),
  durationHours: z.number().int().min(1).max(72).default(8),
});

export const POST = withApi(async (req, { actor }) => {
  if (
    !hasPlatformRole(actor, ["platform_owner", "platform_admin", "support_admin"])
  ) {
    throw forbidden("Only platform support roles can request support access");
  }
  const input = await parseBody(req, requestSchema);
  const request = await requestSupportAccess(actor, input);
  return ok(request, { status: 201 });
});
