import "server-only";

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

// Invitations live in src/lib/services/invitations.ts (hashed tokens, email
// delivery, accept/revoke/resend lifecycle).

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

/** Replaces the member's tenant roles with a single new role (audited). */
export async function replaceMemberRole(
  actor: ActorContext,
  input: { tenantId: string; userId: string; roleCode: TenantRole },
) {
  const admin = getAdminClient();

  const { data: previous } = await admin
    .from("role_assignments")
    .select("id, roles(code)")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .eq("status", "active");

  await admin
    .from("role_assignments")
    .update({ status: "revoked", valid_to: new Date().toISOString() })
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .eq("status", "active");

  const assignment = await assignRole(actor, input);

  type PrevRow = { roles: { code: string } | null };
  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "user.role_changed",
    entityType: "tenant_membership",
    entityId: input.userId,
    previousValue: {
      roles: ((previous ?? []) as unknown as PrevRow[])
        .map((p) => p.roles?.code)
        .filter(Boolean),
    },
    newValue: { role: input.roleCode },
  });

  return assignment;
}

/** Deactivates a member: membership + all active role assignments (audited). */
export async function deactivateMember(
  actor: ActorContext,
  input: { tenantId: string; userId: string; reason?: string },
) {
  const admin = getAdminClient();

  const { data: membership, error } = await admin
    .from("tenant_memberships")
    .update({ status: "removed" })
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!membership) throw new Error("Membership not found");

  await admin
    .from("role_assignments")
    .update({ status: "revoked", valid_to: new Date().toISOString() })
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .eq("status", "active");

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "user.deactivated",
    entityType: "tenant_membership",
    entityId: membership.id,
    newValue: { userId: input.userId },
    reason: input.reason ?? null,
  });

  return membership;
}
