import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPlatformRole, hasTenantRole, isTenantMember } from "@/lib/authz/context";
import { TENANT_ROLES } from "@/lib/authz/roles";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { assignRole } from "@/lib/services/tenants";

export const GET = withApi<{ id: string }>(async (_req, { actor, params }) => {
  if (
    !isTenantMember(actor, params.id) &&
    !hasPlatformRole(actor, ["platform_owner", "platform_admin"])
  ) {
    throw forbidden();
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("id, user_id, status, department, created_at, profiles:user_id(full_name, email)")
    .eq("tenant_id", params.id)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const { data: assignments } = await admin
    .from("role_assignments")
    .select("user_id, roles(code)")
    .eq("tenant_id", params.id)
    .eq("status", "active");

  type AssignmentRow = { user_id: string; roles: { code: string } | null };
  const rolesByUser = new Map<string, string[]>();
  for (const a of (assignments ?? []) as unknown as AssignmentRow[]) {
    if (!a.roles) continue;
    const list = rolesByUser.get(a.user_id) ?? [];
    list.push(a.roles.code);
    rolesByUser.set(a.user_id, list);
  }

  return ok(
    (data ?? []).map((m) => ({
      ...m,
      roles: rolesByUser.get(m.user_id) ?? [],
    })),
  );
});

const assignSchema = z.object({
  userId: z.string().uuid(),
  roleCode: z.enum(TENANT_ROLES),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  if (
    !hasTenantRole(actor, params.id, ["tenant_admin"]) &&
    !hasPlatformRole(actor, ["platform_owner", "platform_admin"])
  ) {
    throw forbidden("Only tenant admins can manage roles");
  }
  const input = await parseBody(req, assignSchema);
  const assignment = await assignRole(actor, {
    tenantId: params.id,
    userId: input.userId,
    roleCode: input.roleCode,
  });
  return ok(assignment, { status: 201 });
});
