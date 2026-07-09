import "server-only";

import { filterTenantsWithUnreadyDataPlane } from "@/lib/server/data-plane";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { getCurrentUser } from "@/lib/server/supabase-server";

import type { Permission, PlatformRole, TenantRole } from "./roles";

export interface ActorContext {
  userId: string;
  email: string | null;
  platformRoles: PlatformRole[];
  /** tenant_id → roles the actor holds in that tenant. */
  tenantRoles: Map<string, TenantRole[]>;
  /** tenant_id → resolved permission codes. */
  tenantPermissions: Map<string, Set<Permission>>;
  /** Tenants where the actor currently has an approved, active support access. */
  supportAccessTenantIds: Set<string>;
}

/**
 * Loads the full actor context for the authenticated user. Uses the service
 * client (post-authentication) so the context itself is not subject to RLS
 * recursion; every API handler authorizes against this context.
 */
export async function getActorContext(): Promise<ActorContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = getAdminClient();

  const [platformRes, assignmentsRes, supportRes] = await Promise.all([
    admin
      .from("platform_admin_users")
      .select("platform_role")
      .eq("user_id", user.id)
      .eq("status", "active"),
    admin
      .from("role_assignments")
      .select("tenant_id, status, valid_to, roles(code, scope, role_permissions(permissions(code)))")
      .eq("user_id", user.id)
      .eq("status", "active"),
    admin
      .from("support_access_requests")
      .select("tenant_id")
      .eq("requested_by", user.id)
      .eq("status", "approved")
      .gt("expires_at", new Date().toISOString()),
  ]);

  const platformRoles = (platformRes.data ?? []).map(
    (r) => r.platform_role as PlatformRole,
  );

  const tenantRoles = new Map<string, TenantRole[]>();
  const tenantPermissions = new Map<string, Set<Permission>>();

  type AssignmentRow = {
    tenant_id: string | null;
    valid_to: string | null;
    roles: {
      code: string;
      scope: string;
      role_permissions: { permissions: { code: string } | null }[];
    } | null;
  };

  for (const raw of (assignmentsRes.data ?? []) as unknown as AssignmentRow[]) {
    if (!raw.tenant_id || !raw.roles || raw.roles.scope !== "tenant") continue;
    if (raw.valid_to && new Date(raw.valid_to) < new Date()) continue;

    const roles = tenantRoles.get(raw.tenant_id) ?? [];
    roles.push(raw.roles.code as TenantRole);
    tenantRoles.set(raw.tenant_id, roles);

    const perms = tenantPermissions.get(raw.tenant_id) ?? new Set<Permission>();
    for (const rp of raw.roles.role_permissions ?? []) {
      if (rp.permissions?.code) perms.add(rp.permissions.code as Permission);
    }
    tenantPermissions.set(raw.tenant_id, perms);
  }

  const supportAccessTenantIds = new Set<string>(
    (supportRes.data ?? []).map((r) => r.tenant_id as string),
  );

  // FAIL CLOSED for Model B/C tenants whose data plane is not provisioned:
  // drop those memberships entirely so every authorization check
  // (isTenantMember/hasPermission) denies access until provisioning is done.
  const candidateTenantIds = [
    ...new Set([...tenantRoles.keys(), ...supportAccessTenantIds]),
  ];
  if (candidateTenantIds.length > 0) {
    const unready = await filterTenantsWithUnreadyDataPlane(candidateTenantIds);
    for (const tenantId of unready) {
      tenantRoles.delete(tenantId);
      tenantPermissions.delete(tenantId);
      supportAccessTenantIds.delete(tenantId);
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    platformRoles,
    tenantRoles,
    tenantPermissions,
    supportAccessTenantIds,
  };
}

export function isPlatformAdmin(ctx: ActorContext): boolean {
  return ctx.platformRoles.length > 0;
}

export function hasPlatformRole(
  ctx: ActorContext,
  roles: PlatformRole[],
): boolean {
  return ctx.platformRoles.some((r) => roles.includes(r));
}

export function isTenantMember(ctx: ActorContext, tenantId: string): boolean {
  return ctx.tenantRoles.has(tenantId) || ctx.supportAccessTenantIds.has(tenantId);
}

export function hasTenantRole(
  ctx: ActorContext,
  tenantId: string,
  roles: TenantRole[],
): boolean {
  const held = ctx.tenantRoles.get(tenantId) ?? [];
  return held.some((r) => roles.includes(r));
}

export function hasPermission(
  ctx: ActorContext,
  tenantId: string,
  permission: Permission,
): boolean {
  return ctx.tenantPermissions.get(tenantId)?.has(permission) ?? false;
}
