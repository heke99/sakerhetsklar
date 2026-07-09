import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type StatusColor } from "@/components/app/status-badge";
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

import { CreateTenantForm } from "./create-tenant-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tenants" };

const deploymentLabels: Record<string, string> = {
  multi_tenant: "A — SaaS",
  single_tenant: "B — Single-tenant",
  customer_owned: "C — Customer-owned",
};

function tenantStatusColor(status: string, onboarding: string): StatusColor {
  if (status === "paused" || status === "disabled") return "red";
  if (onboarding === "not_started") return "gray";
  if (onboarding === "in_progress") return "blue";
  if (onboarding === "blocked") return "yellow";
  return "green";
}

export default async function TenantListPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const [tenantsRes, cpRes] = await Promise.all([
    admin
      .from("tenants")
      .select("id, name, slug, organization_number, status, plan, deployment_model, onboarding_status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("control_plane_tenants")
      .select(
        "tenant_id, health_status, production_readiness, rule_package_version, product_version, open_incident_count, last_activity_at",
      ),
  ]);

  const cpByTenant = new Map((cpRes.data ?? []).map((c) => [c.tenant_id, c]));

  return (
    <main className="p-8">
      <PageHeader
        title="Tenants"
        description="All tenants with classification, deployment model, onboarding, incidents and readiness."
      />

      <div className="mb-4">
        <CreateTenantForm />
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Org.nr</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deployment</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead>Open incidents</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Prod readiness</TableHead>
              <TableHead>App version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tenantsRes.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground">
                  No tenants yet. Use &quot;Create tenant&quot; above to onboard the first customer.
                </TableCell>
              </TableRow>
            ) : (
              (tenantsRes.data ?? []).map((t) => {
                const cp = cpByTenant.get(t.id);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/platform/tenants/${t.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell>{t.organization_number ?? "–"}</TableCell>
                    <TableCell>
                      <StatusBadge color={tenantStatusColor(t.status, t.onboarding_status)}>
                        {t.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{deploymentLabels[t.deployment_model] ?? t.deployment_model}</TableCell>
                    <TableCell className="capitalize">{t.plan}</TableCell>
                    <TableCell>{t.onboarding_status}</TableCell>
                    <TableCell>{cp?.open_incident_count ?? 0}</TableCell>
                    <TableCell>{cp?.health_status ?? "unknown"}</TableCell>
                    <TableCell>{cp?.production_readiness ?? "not_started"}</TableCell>
                    <TableCell>{cp?.product_version ?? "–"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
