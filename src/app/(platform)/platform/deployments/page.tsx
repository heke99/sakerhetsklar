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
export const metadata = { title: "Deployments" };

export default async function DeploymentsPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const [planesRes, readinessRes] = await Promise.all([
    admin
      .from("tenant_data_plane_connections")
      .select("id, tenant_id, environment, plane_kind, status, owned_by, supabase_url, created_at, tenants(name, deployment_model)")
      .order("created_at", { ascending: false }),
    admin
      .from("tenant_production_readiness")
      .select("tenant_id, gate_code, gate_name, status, tenants(name)")
      .neq("status", "passed")
      .order("tenant_id"),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Deployments"
        description="Data planes (Model B/C), environments and open production readiness gates. Secrets are stored only as server-side references."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Data-plane connections</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Owned by</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(planesRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No isolated data planes registered. Model A tenants use the shared data plane.
                  </TableCell>
                </TableRow>
              ) : (
                (planesRes.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {(p.tenants as unknown as { name: string } | null)?.name ?? "–"}
                    </TableCell>
                    <TableCell>
                      {(p.tenants as unknown as { deployment_model: string } | null)?.deployment_model ?? "–"}
                    </TableCell>
                    <TableCell>{p.environment}</TableCell>
                    <TableCell>{p.plane_kind}</TableCell>
                    <TableCell>{p.owned_by}</TableCell>
                    <TableCell>
                      <StatusBadge color={p.status === "active" ? "green" : "yellow"}>
                        {p.status}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Open production readiness gates</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Gate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(readinessRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    All gates passed or no gates registered.
                  </TableCell>
                </TableRow>
              ) : (
                (readinessRes.data ?? []).map((g) => (
                  <TableRow key={`${g.tenant_id}-${g.gate_code}`}>
                    <TableCell>{(g.tenants as unknown as { name: string } | null)?.name ?? "–"}</TableCell>
                    <TableCell>{g.gate_name}</TableCell>
                    <TableCell>
                      <StatusBadge
                        color={
                          g.status === "blocked"
                            ? "red"
                            : g.status === "in_progress"
                              ? "blue"
                              : "gray"
                        }
                      >
                        {g.status}
                      </StatusBadge>
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
