import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";
import { TENANT_ROLES } from "@/lib/authz/roles";
import { getAdminClient } from "@/lib/server/supabase-admin";
import {
  createInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/lib/services/invitations";
import { assertUserLimitNotReached } from "@/lib/services/entitlements";

function canManageInvitations(
  actor: Parameters<typeof hasTenantRole>[0],
  tenantId: string,
): boolean {
  return (
    hasTenantRole(actor, tenantId, ["tenant_admin"]) ||
    hasPlatformRole(actor, ["platform_owner", "platform_admin"])
  );
}

export const GET = withApi<{ id: string }>(async (_req, { actor, params }) => {
  if (!canManageInvitations(actor, params.id)) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenant_invitations")
    .select("id, email, role_code, status, expires_at, created_at")
    .eq("tenant_id", params.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

const inviteSchema = z.object({
  email: z.string().email(),
  roleCode: z.enum(TENANT_ROLES),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  if (!canManageInvitations(actor, params.id)) {
    throw forbidden("Only tenant admins can invite users");
  }
  const input = await parseBody(req, inviteSchema);
  await assertUserLimitNotReached(params.id);
  const { invitation, inviteUrl, emailDelivered } = await createInvitation(actor, {
    tenantId: params.id,
    email: input.email,
    roleCode: input.roleCode,
  });
  return ok(
    {
      id: invitation.id,
      email: invitation.email,
      roleCode: invitation.role_code,
      expiresAt: invitation.expires_at,
      emailDelivered,
      // Only present outside production (see createInvitation).
      ...(inviteUrl ? { inviteUrl } : {}),
    },
    { status: 201 },
  );
});

const patchSchema = z.object({
  invitationId: z.string().uuid(),
  action: z.enum(["revoke", "resend"]),
});

export const PATCH = withApi<{ id: string }>(async (req, { actor, params }) => {
  if (!canManageInvitations(actor, params.id)) throw forbidden();
  const input = await parseBody(req, patchSchema);

  if (input.action === "revoke") {
    const invitation = await revokeInvitation(actor, {
      tenantId: params.id,
      invitationId: input.invitationId,
    });
    return ok(invitation);
  }

  const { invitation, inviteUrl, emailDelivered } = await resendInvitation(actor, {
    tenantId: params.id,
    invitationId: input.invitationId,
  });
  return ok({
    id: invitation.id,
    email: invitation.email,
    emailDelivered,
    ...(inviteUrl ? { inviteUrl } : {}),
  });
});
