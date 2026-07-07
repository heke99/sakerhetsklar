import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";
import { TENANT_ROLES } from "@/lib/authz/roles";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { inviteUser } from "@/lib/services/tenants";

const inviteSchema = z.object({
  email: z.string().email(),
  roleCode: z.enum(TENANT_ROLES),
});

export const GET = withApi<{ id: string }>(async (_req, { actor, params }) => {
  if (
    !hasTenantRole(actor, params.id, ["tenant_admin"]) &&
    !hasPlatformRole(actor, ["platform_owner", "platform_admin"])
  ) {
    throw forbidden();
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenant_invitations")
    .select("id, email, role_code, status, expires_at, created_at")
    .eq("tenant_id", params.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  if (
    !hasTenantRole(actor, params.id, ["tenant_admin"]) &&
    !hasPlatformRole(actor, ["platform_owner", "platform_admin"])
  ) {
    throw forbidden("Only tenant admins can invite users");
  }
  const input = await parseBody(req, inviteSchema);
  const { invitation, token } = await inviteUser(actor, {
    tenantId: params.id,
    email: input.email,
    roleCode: input.roleCode,
    invitedBy: actor.userId,
  });
  return ok(
    {
      id: invitation.id,
      email: invitation.email,
      roleCode: invitation.role_code,
      expiresAt: invitation.expires_at,
      // Raw token returned once so the caller can deliver the invite link.
      token,
    },
    { status: 201 },
  );
});
