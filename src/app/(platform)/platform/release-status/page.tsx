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
export const metadata = { title: "Release status" };

export default async function ReleaseStatusPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const [releasesRes, migrationsRes] = await Promise.all([
    admin
      .from("tenant_release_status")
      .select("*, tenants(name)")
      .order("released_at", { ascending: false })
      .limit(100),
    admin
      .from("tenant_migration_status")
      .select("*, tenants(name)")
      .neq("status", "applied")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Release status"
        description="App versions, rule package versions and pending migrations per tenant."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Releases</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>App version</TableHead>
                <TableHead>Rule package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Released</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(releasesRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No releases recorded.
                  </TableCell>
                </TableRow>
              ) : (
                (releasesRes.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{(r.tenants as { name: string } | null)?.name ?? "–"}</TableCell>
                    <TableCell className="font-mono text-sm">{r.app_version}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {r.rule_package_version ?? "–"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        color={
                          r.status === "deployed"
                            ? "green"
                            : r.status === "failed" || r.status === "rolled_back"
                              ? "red"
                              : "blue"
                        }
                      >
                        {r.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{new Date(r.released_at).toLocaleString("sv-SE")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pending or failed migrations</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Migration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(migrationsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    All migrations applied.
                  </TableCell>
                </TableRow>
              ) : (
                (migrationsRes.data ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{(m.tenants as { name: string } | null)?.name ?? "–"}</TableCell>
                    <TableCell className="font-mono text-sm">{m.migration_name}</TableCell>
                    <TableCell>
                      <StatusBadge color={m.status === "failed" ? "red" : "yellow"}>
                        {m.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="max-w-sm truncate">{m.error_summary ?? "–"}</TableCell>
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
