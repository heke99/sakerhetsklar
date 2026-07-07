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
export const metadata = { title: "Health" };

export default async function HealthPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const [cpRes, checksRes] = await Promise.all([
    admin
      .from("control_plane_tenants")
      .select("*, tenants(name)")
      .order("health_status"),
    admin
      .from("tenant_health_checks")
      .select("*, tenants(name)")
      .order("checked_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Tenant health"
        description="Data-plane health, migration status and backup status per tenant. No tenant content is stored here."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Status by tenant</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Migrations</TableHead>
                <TableHead>Backups</TableHead>
                <TableHead>Prod readiness</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cpRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No control-plane registrations yet.
                  </TableCell>
                </TableRow>
              ) : (
                (cpRes.data ?? []).map((c) => (
                  <TableRow key={c.tenant_id}>
                    <TableCell>{(c.tenants as { name: string } | null)?.name ?? "–"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        color={
                          c.health_status === "healthy"
                            ? "green"
                            : c.health_status === "degraded"
                              ? "yellow"
                              : c.health_status === "unhealthy"
                                ? "red"
                                : "gray"
                        }
                      >
                        {c.health_status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{c.migration_status}</TableCell>
                    <TableCell>{c.backup_status}</TableCell>
                    <TableCell>{c.production_readiness}</TableCell>
                    <TableCell>
                      {c.last_activity_at
                        ? new Date(c.last_activity_at).toLocaleString("sv-SE")
                        : "–"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent health checks</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Check</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(checksRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No health checks recorded.
                  </TableCell>
                </TableRow>
              ) : (
                (checksRes.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{(c.tenants as { name: string } | null)?.name ?? "–"}</TableCell>
                    <TableCell className="font-mono text-sm">{c.check_code}</TableCell>
                    <TableCell>
                      <StatusBadge color={c.status === "healthy" ? "green" : "red"}>
                        {c.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{new Date(c.checked_at).toLocaleString("sv-SE")}</TableCell>
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
