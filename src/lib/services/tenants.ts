import "server-only";

import { randomBytes, createHash } from "node:crypto";

import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";
import type { TenantRole } from "@/lib/authz/roles";

export interface CreateTenantInput {
  name: string;
  organizationNumber?: string;
  slug: string;
  organizationType?: string;
  deploymentModel?: "multi_tenant" | "single_tenant" | "customer_owned";
  plan?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
}

export async function createTenant(actor: ActorContext, input: CreateTenantInput) {
  const admin = getAdminClient();

  const { data: tenant, error } = await admin
    .from("tenants")
    .insert({
      name: input.name,
      organization_number: input.organizationNumber ?? null,
      slug: input.slug,
      organization_type: input.organizationType ?? null,
      deployment_model: input.deploymentModel ?? "multi_tenant",
      plan: input.plan ?? "starter",
      primary_contact_name: input.primaryContactName ?? null,
      primary_contact_email: input.primaryContactEmail ?? null,
      created_by: actor.userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create tenant: ${error.message}`);

  await admin.from("tenant_settings").insert({ tenant_id: tenant.id });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: actor.userId,
    actorRole: actor.platformRoles[0] ?? null,
    action: "tenant.created",
    entityType: "tenant",
    entityId: tenant.id,
    newValue: { name: tenant.name, slug: tenant.slug },
  });

  return tenant;
}

export interface InviteUserInput {
  tenantId: string;
  email: string;
  roleCode: TenantRole;
  invitedBy: string;
}

export async function inviteUser(actor: ActorContext, input: InviteUserInput) {
  const admin = getAdminClient();

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const { data: invitation, error } = await admin
    .from("tenant_invitations")
    .insert({
      tenant_id: input.tenantId,
      email: input.email,
      role_code: input.roleCode,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: input.invitedBy,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create invitation: ${error.message}`);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "tenant.user_invited",
    entityType: "tenant_invitation",
    entityId: invitation.id,
    newValue: { email: input.email, role: input.roleCode },
  });

  // The raw token is returned once for delivery (email integration); only the
  // hash is stored.
  return { invitation, token };
}

export async function assignRole(
  actor: ActorContext,
  input: { tenantId: string; userId: string; roleCode: TenantRole },
) {
  const admin = getAdminClient();

  const { data: role } = await admin
    .from("roles")
    .select("id, code")
    .eq("code", input.roleCode)
    .eq("scope", "tenant")
    .single();
  if (!role) throw new Error(`Unknown tenant role: ${input.roleCode}`);

  await admin.from("tenant_memberships").upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId,
      status: "active",
      created_by: actor.userId,
    },
    { onConflict: "tenant_id,user_id" },
  );

  const { data: assignment, error } = await admin
    .from("role_assignments")
    .upsert(
      {
        tenant_id: input.tenantId,
        user_id: input.userId,
        role_id: role.id,
        status: "active",
        created_by: actor.userId,
      },
      { onConflict: "user_id,role_id,tenant_id" },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to assign role: ${error.message}`);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "user.role_changed",
    entityType: "role_assignment",
    entityId: assignment.id,
    newValue: { userId: input.userId, role: input.roleCode },
  });

  return assignment;
}
