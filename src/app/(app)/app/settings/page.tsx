import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TENANT_ROLE_LABELS_SV, type TenantRole } from "@/lib/authz/roles";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inställningar" };

const deploymentModelLabels: Record<string, string> = {
  multi_tenant: "Delad drift (Model A)",
  single_tenant: "Egen isolerad drift (Model B)",
  customer_owned: "Kundägd datamiljö (Model C)",
};

export default async function SettingsPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

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
      .eq("status", "pending"),
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
  const members = (membersRes.data ?? []) as unknown as MemberRow[];

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
            <dd className="font-medium capitalize">{tenant.plan}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Driftmodell</dt>
            <dd className="font-medium">
              {deploymentModelLabels[tenant.deployment_model] ?? tenant.deployment_model}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Användare</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Roller</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Inga användare ännu.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell>{m.profiles?.full_name ?? "–"}</TableCell>
                    <TableCell>{m.profiles?.email ?? "–"}</TableCell>
                    <TableCell className="space-x-1">
                      {(rolesByUser.get(m.user_id) ?? []).map((code) => (
                        <StatusBadge key={code} color="blue">
                          {TENANT_ROLE_LABELS_SV[code as TenantRole] ?? code}
                        </StatusBadge>
                      ))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Väntande inbjudningar</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-post</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Giltig till</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invitationsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Inga väntande inbjudningar.
                  </TableCell>
                </TableRow>
              ) : (
                (invitationsRes.data ?? []).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      {TENANT_ROLE_LABELS_SV[inv.role_code as TenantRole] ?? inv.role_code}
                    </TableCell>
                    <TableCell>
                      {new Date(inv.expires_at).toLocaleDateString("sv-SE")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
