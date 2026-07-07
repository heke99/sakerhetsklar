import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import {
  decideSupportAccess,
  revokeSupportAccess,
} from "@/lib/services/support-access";

const actionSchema = z.object({
  action: z.enum(["approve", "deny", "revoke"]),
  reason: z.string().max(1000).optional(),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, actionSchema);

  const admin = getAdminClient();
  const { data: request } = await admin
    .from("support_access_requests")
    .select("id, tenant_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!request) throw notFound("Support access request not found");

  if (input.action === "approve" || input.action === "deny") {
    // Tenant approval required (spec §6): tenant admin/CISO decides.
    if (!hasTenantRole(actor, request.tenant_id, ["tenant_admin", "ciso"])) {
      throw forbidden("Support access must be approved by the tenant");
    }
    const decided = await decideSupportAccess(actor, {
      requestId: params.id,
      decision: input.action === "approve" ? "approved" : "denied",
      reason: input.reason,
    });
    return ok(decided);
  }

  // Revoke: tenant admin, or platform security/admin roles.
  if (
    !hasTenantRole(actor, request.tenant_id, ["tenant_admin", "ciso"]) &&
    !hasPlatformRole(actor, ["platform_owner", "platform_admin", "security_admin"])
  ) {
    throw forbidden();
  }
  if (!input.reason) throw forbidden("Revocation requires a reason");
  const revoked = await revokeSupportAccess(actor, {
    requestId: params.id,
    reason: input.reason,
  });
  return ok(revoked);
});
