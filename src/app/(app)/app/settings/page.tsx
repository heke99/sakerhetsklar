import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { hasPlatformRole, hasTenantRole } from "@/lib/authz/context";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { UserManagement, type InvitationItem, type MemberItem } from "./user-management";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inställningar" };

const deploymentModelLabels: Record<string, string> = {
  multi_tenant: "Delad drift (Model A)",
  single_tenant: "Egen isolerad drift (Model B)",
  customer_owned: "Kundägd datamiljö (Model C)",
};

const planLabels: Record<string, string> = {
  starter: "Bas",
  business: "Verksamhet",
  enterprise: "Enterprise",
};

export default async function SettingsPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { actor, tenant } = current;

  const canManage =
    hasTenantRole(actor, tenant.id, ["tenant_admin"]) ||
    hasPlatformRole(actor, ["platform_owner", "platform_admin"]);

  const admin = getAdminClient();
  const [membersRes, assignmentsRes, invitationsRes] = await Promise.all([
    admin
      .from("tenant_memberships")
      .select("user_id, status, profiles:user_id(full_name, email)")
      .eq("tenant_id", tenant.id)
      .eq("status", "active"),
    admin
      .from("role_assignments")
      .select("user_id, roles(code)")
      .eq("tenant_id", tenant.id)
      .eq("status", "active"),
    admin
      .from("tenant_invitations")
      .select("id, email, role_code, status, expires_at")
      .eq("tenant_id", tenant.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  type AssignmentRow = { user_id: string; roles: { code: string } | null };
  const rolesByUser = new Map<string, string[]>();
  for (const a of (assignmentsRes.data ?? []) as unknown as AssignmentRow[]) {
    if (!a.roles) continue;
    const list = rolesByUser.get(a.user_id) ?? [];
    list.push(a.roles.code);
    rolesByUser.set(a.user_id, list);
  }

  type MemberRow = {
    user_id: string;
    status: string;
    profiles: { full_name: string | null; email: string | null } | null;
  };
  const members: MemberItem[] = (
    (membersRes.data ?? []) as unknown as MemberRow[]
  ).map((m) => ({
    userId: m.user_id,
    fullName: m.profiles?.full_name ?? null,
    email: m.profiles?.email ?? null,
    roles: rolesByUser.get(m.user_id) ?? [],
  }));

  const invitations: InvitationItem[] = (invitationsRes.data ?? []).map(
    (inv) => ({
      id: inv.id as string,
      email: inv.email as string,
      roleCode: inv.role_code as string,
      expiresAt: inv.expires_at as string,
    }),
  );

  return (
    <main className="p-8">
      <PageHeader
        title="Inställningar"
        description="Organisation, användare, roller och supportåtkomst."
      />

      <section className="mb-8 rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Organisation</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Namn</dt>
            <dd className="font-medium">{tenant.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Organisationsnummer</dt>
            <dd className="font-medium">{tenant.organization_number ?? "Saknas"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-medium">{planLabels[tenant.plan] ?? tenant.plan}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Driftmodell</dt>
            <dd className="font-medium">
              {deploymentModelLabels[tenant.deployment_model] ?? tenant.deployment_model}
            </dd>
          </div>
        </dl>
      </section>

      <UserManagement
        tenantId={tenant.id}
        currentUserId={actor.userId}
        members={members}
        invitations={invitations}
        canManage={canManage}
      />
    </main>
  );
}
