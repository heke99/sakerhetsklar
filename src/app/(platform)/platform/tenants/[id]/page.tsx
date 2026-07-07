import { notFound } from "next/navigation";

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
import { requirePlatformRole } from "@/lib/services/require-platform";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tenant profile" };

export default async function TenantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformRole();
  const { id } = await params;
  const admin = getAdminClient();

  const [tenantRes, domainsRes, readinessRes, ruleVersionsRes, supportRes, deploymentRes] =
    await Promise.all([
      admin
        .from("tenants")
        .select("*, control_plane_tenants(*)")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
      admin.from("tenant_domains").select("*").eq("tenant_id", id),
      admin.from("tenant_production_readiness").select("*").eq("tenant_id", id).order("gate_code"),
      admin
        .from("tenant_rule_package_versions")
        .select("*")
        .eq("tenant_id", id)
        .eq("status", "active"),
      admin
        .from("support_access_requests")
        .select("*")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("tenant_deployment_models")
        .select("*")
        .eq("tenant_id", id)
        .order("effective_from", { ascending: false })
        .limit(5),
    ]);

  const tenant = tenantRes.data;
  if (!tenant) notFound();

  return (
    <main className="p-8">
      <PageHeader
        title={tenant.name}
        description={`Tenant profile — onboarding, deployment, rule packages and support access. No sensitive incident content is shown here.`}
      />

      <section className="mb-8 rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Overview</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Organization number</dt>
            <dd className="font-medium">{tenant.organization_number ?? "–"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge color={tenant.status === "active" ? "green" : "red"}>
                {tenant.status}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-medium capitalize">{tenant.plan}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deployment model</dt>
            <dd className="font-medium">{tenant.deployment_model}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Onboarding</dt>
            <dd className="font-medium">{tenant.onboarding_status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-medium">{tenant.slug ?? "–"}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Domains</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Primary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(domainsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No domains registered.
                  </TableCell>
                </TableRow>
              ) : (
                (domainsRes.data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">{d.domain}</TableCell>
                    <TableCell>{d.environment}</TableCell>
                    <TableCell>
                      <StatusBadge color={d.status === "active" ? "green" : "yellow"}>
                        {d.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{d.is_primary ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Production readiness gates</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(readinessRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No readiness gates registered.
                  </TableCell>
                </TableRow>
              ) : (
                (readinessRes.data ?? []).map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.gate_name}</TableCell>
                    <TableCell>
                      <StatusBadge
                        color={
                          g.status === "passed"
                            ? "green"
                            : g.status === "blocked"
                              ? "red"
                              : g.status === "in_progress"
                                ? "blue"
                                : "gray"
                        }
                      >
                        {g.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {g.checked_at ? new Date(g.checked_at).toLocaleString("sv-SE") : "–"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Active rule packages</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule set</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ruleVersionsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No rule packages assigned — tenant is missing a rule profile.
                  </TableCell>
                </TableRow>
              ) : (
                (ruleVersionsRes.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.rule_set_code}</TableCell>
                    <TableCell>{r.version}</TableCell>
                    <TableCell>{new Date(r.assigned_at).toLocaleDateString("sv-SE")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Deployment model history</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Effective from</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(deploymentRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No deployment model history.
                  </TableCell>
                </TableRow>
              ) : (
                (deploymentRes.data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.deployment_model}</TableCell>
                    <TableCell>{d.variant ?? "–"}</TableCell>
                    <TableCell>{new Date(d.effective_from).toLocaleString("sv-SE")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Support access</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purpose</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(supportRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No support access requests.
                  </TableCell>
                </TableRow>
              ) : (
                (supportRes.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-md truncate">{s.purpose}</TableCell>
                    <TableCell>{s.scope}</TableCell>
                    <TableCell>
                      <StatusBadge
                        color={
                          s.status === "approved"
                            ? "yellow"
                            : s.status === "requested"
                              ? "blue"
                              : s.status === "revoked" || s.status === "denied"
                                ? "red"
                                : "gray"
                        }
                      >
                        {s.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {s.expires_at ? new Date(s.expires_at).toLocaleString("sv-SE") : "–"}
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
