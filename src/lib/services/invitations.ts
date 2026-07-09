import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { ApiError } from "@/lib/api/handler";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";
import type { TenantRole } from "@/lib/authz/roles";
import { sendEmail, isEmailConfigured } from "@/lib/server/email";
import { env } from "@/lib/server/env";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { assignRole } from "./tenants";

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function inviteUrl(token: string): string {
  return `${env.appBaseUrl}/invite/accept?token=${token}`;
}

async function deliverInviteEmail(input: {
  email: string;
  tenantName: string;
  token: string;
}): Promise<{ delivered: boolean }> {
  const url = inviteUrl(input.token);
  const { delivered } = await sendEmail({
    to: input.email,
    subject: `Inbjudan till Säkerhetsklar — ${input.tenantName}`,
    text: [
      `Du har blivit inbjuden till ${input.tenantName} i Säkerhetsklar.`,
      "",
      `Acceptera inbjudan: ${url}`,
      "",
      "Länken är personlig och giltig i 7 dagar. Om du inte väntade dig denna inbjudan kan du bortse från meddelandet.",
    ].join("\n"),
  });
  return { delivered };
}

export interface CreateInvitationInput {
  tenantId: string;
  email: string;
  roleCode: TenantRole;
}

/**
 * Creates an invitation with a hashed token and delivers the invite link by
 * email. Fail-closed in production: without a configured email provider the
 * invitation is not created (the raw token must never be exposed through the
 * API in production). In development the invite URL is returned for testing.
 */
export async function createInvitation(
  actor: ActorContext,
  input: CreateInvitationInput,
): Promise<{
  invitation: Record<string, unknown>;
  inviteUrl?: string;
  emailDelivered: boolean;
}> {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && !isEmailConfigured()) {
    throw new ApiError(
      503,
      "E-postleverans är inte konfigurerad. Inbjudningar kan inte skickas säkert utan e-postleverantör (RESEND_API_KEY/EMAIL_FROM).",
      "email_not_configured",
    );
  }

  const admin = getAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, status")
    .eq("id", input.tenantId)
    .maybeSingle();
  if (!tenant) throw new ApiError(404, "Resource not found", "not_found");
  if (tenant.status && tenant.status !== "active") {
    throw new ApiError(409, "Organisationen är inte aktiv.", "tenant_inactive");
  }

  // Revoke prior pending invitations for the same email so only one link is live.
  await admin
    .from("tenant_invitations")
    .update({ status: "revoked" })
    .eq("tenant_id", input.tenantId)
    .eq("email", input.email)
    .eq("status", "pending");

  const token = randomBytes(32).toString("hex");
  const { data: invitation, error } = await admin
    .from("tenant_invitations")
    .insert({
      tenant_id: input.tenantId,
      email: input.email,
      role_code: input.roleCode,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      invited_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create invitation: ${error.message}`);

  const { delivered } = await deliverInviteEmail({
    email: input.email,
    tenantName: tenant.name as string,
    token,
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "tenant.user_invited",
    entityType: "tenant_invitation",
    entityId: invitation.id,
    newValue: { email: input.email, role: input.roleCode, emailDelivered: delivered },
  });

  return {
    invitation,
    // Raw invite link only outside production (dev/test convenience).
    ...(isProduction ? {} : { inviteUrl: inviteUrl(token) }),
    emailDelivered: delivered,
  };
}

export async function revokeInvitation(
  actor: ActorContext,
  input: { tenantId: string; invitationId: string },
) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenant_invitations")
    .update({ status: "revoked" })
    .eq("id", input.invitationId)
    .eq("tenant_id", input.tenantId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ApiError(404, "Resource not found", "not_found");

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "tenant.invitation_revoked",
    entityType: "tenant_invitation",
    entityId: input.invitationId,
    newValue: { email: data.email },
  });

  return data;
}

/** Revokes the old invitation and issues a fresh one to the same address. */
export async function resendInvitation(
  actor: ActorContext,
  input: { tenantId: string; invitationId: string },
) {
  const admin = getAdminClient();
  const { data: existing } = await admin
    .from("tenant_invitations")
    .select("id, email, role_code, status")
    .eq("id", input.invitationId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!existing) throw new ApiError(404, "Resource not found", "not_found");

  return createInvitation(actor, {
    tenantId: input.tenantId,
    email: existing.email as string,
    roleCode: existing.role_code as TenantRole,
  });
}

interface InvitationRow {
  id: string;
  tenant_id: string;
  email: string;
  role_code: string;
  status: string;
  expires_at: string;
}

/**
 * Verifies a raw invite token: exists, pending, not expired, tenant active.
 * Marks expired invitations as such. Throws 404 for anything invalid so the
 * endpoint does not reveal why a token failed.
 */
async function verifyToken(token: string): Promise<{
  invitation: InvitationRow;
  tenantName: string;
}> {
  const admin = getAdminClient();
  const { data: invitation } = await admin
    .from("tenant_invitations")
    .select("id, tenant_id, email, role_code, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!invitation || invitation.status !== "pending") {
    throw new ApiError(404, "Inbjudan är ogiltig eller har upphört.", "invalid_invitation");
  }
  if (new Date(invitation.expires_at) < new Date()) {
    await admin
      .from("tenant_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);
    throw new ApiError(404, "Inbjudan är ogiltig eller har upphört.", "invalid_invitation");
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, status")
    .eq("id", invitation.tenant_id)
    .maybeSingle();
  if (!tenant || (tenant.status && tenant.status !== "active")) {
    throw new ApiError(404, "Inbjudan är ogiltig eller har upphört.", "invalid_invitation");
  }

  return { invitation: invitation as InvitationRow, tenantName: tenant.name as string };
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = getAdminClient();
  // profiles mirrors auth.users (kept in sync at accept/login time).
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle();
  if (profile?.user_id) return profile.user_id as string;

  // Fallback: page through auth admin users (small installations).
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Public lookup used by the accept page: returns safe invitation info. */
export async function lookupInvitation(token: string): Promise<{
  email: string;
  tenantName: string;
  roleCode: string;
  userExists: boolean;
}> {
  const { invitation, tenantName } = await verifyToken(token);
  const userId = await findUserIdByEmail(invitation.email);
  return {
    email: invitation.email,
    tenantName,
    roleCode: invitation.role_code,
    userExists: userId !== null,
  };
}

export type AcceptResult =
  | { status: "accepted"; tenantId: string; email: string }
  | { status: "requires_login"; email: string };

/**
 * Accepts an invitation.
 *
 * - Existing account + authenticated as that account → attach membership/role.
 * - Existing account, not authenticated → tell the client to log in first.
 * - No account + password supplied → create the account (email pre-confirmed,
 *   since the invite link itself proves mailbox access), attach role.
 */
export async function acceptInvitation(input: {
  token: string;
  password?: string;
  authenticatedUserId?: string;
  authenticatedEmail?: string | null;
}): Promise<AcceptResult> {
  const admin = getAdminClient();
  const { invitation } = await verifyToken(input.token);

  const existingUserId = await findUserIdByEmail(invitation.email);
  let userId: string;

  if (existingUserId) {
    const isSelf =
      input.authenticatedUserId === existingUserId ||
      (input.authenticatedEmail ?? "").toLowerCase() ===
        invitation.email.toLowerCase();
    if (!input.authenticatedUserId || !isSelf) {
      return { status: "requires_login", email: invitation.email };
    }
    userId = existingUserId;
  } else {
    if (!input.password || input.password.length < 12) {
      throw new ApiError(
        422,
        "Ett lösenord på minst 12 tecken krävs för att skapa kontot.",
        "password_required",
      );
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email: invitation.email,
      password: input.password,
      email_confirm: true,
    });
    if (error || !created?.user) {
      throw new Error(`Failed to create user: ${error?.message ?? "unknown"}`);
    }
    userId = created.user.id;

    await admin.from("profiles").upsert(
      { user_id: userId, email: invitation.email },
      { onConflict: "user_id" },
    );
  }

  // System actor for the role assignment (the invitee authorizes via token).
  const systemActor: ActorContext = {
    userId,
    email: invitation.email,
    platformRoles: [],
    tenantRoles: new Map(),
    tenantPermissions: new Map(),
    supportAccessTenantIds: new Set(),
  };
  await assignRole(systemActor, {
    tenantId: invitation.tenant_id,
    userId,
    roleCode: invitation.role_code as TenantRole,
  });

  await admin
    .from("tenant_invitations")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  await writeAuditLog({
    tenantId: invitation.tenant_id,
    actorUserId: userId,
    action: "tenant.invitation_accepted",
    entityType: "tenant_invitation",
    entityId: invitation.id,
    newValue: { email: invitation.email, role: invitation.role_code },
  });

  return {
    status: "accepted",
    tenantId: invitation.tenant_id,
    email: invitation.email,
  };
}
