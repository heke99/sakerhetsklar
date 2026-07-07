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
export const metadata = { title: "Security" };

export default async function PlatformSecurityPage() {
  await requirePlatformRole(["platform_owner", "security_admin", "readonly_auditor", "platform_admin"]);
  const admin = getAdminClient();

  const [anomaliesRes, breakGlassRes, supportRes, casesRes] = await Promise.all([
    admin
      .from("security_anomaly_events")
      .select("*, tenants(name)")
      .order("detected_at", { ascending: false })
      .limit(50),
    admin
      .from("break_glass_sessions")
      .select("*, tenants(name)")
      .order("started_at", { ascending: false })
      .limit(50),
    admin
      .from("support_access_requests")
      .select("*, tenants(name)")
      .eq("status", "approved")
      .order("approved_at", { ascending: false })
      .limit(50),
    admin
      .from("anomaly_review_cases")
      .select("*")
      .eq("status", "open")
      .limit(100),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Platform security"
        description="Anomalies, break-glass sessions, active support access and open review cases across all tenants."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Open anomaly review cases</p>
          <p className="mt-1 text-2xl font-bold">{(casesRes.data ?? []).length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active break-glass sessions</p>
          <p className="mt-1 text-2xl font-bold">
            {(breakGlassRes.data ?? []).filter((b) => b.status === "active").length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Approved support access</p>
          <p className="mt-1 text-2xl font-bold">{(supportRes.data ?? []).length}</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Security anomalies</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Detected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(anomaliesRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No anomalies detected.
                  </TableCell>
                </TableRow>
              ) : (
                (anomaliesRes.data ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {(a.tenants as unknown as { name: string } | null)?.name ?? "platform"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.rule_code}</TableCell>
                    <TableCell>
                      <StatusBadge color={a.severity === "critical" ? "red" : "yellow"}>
                        {a.severity}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{a.detail}</TableCell>
                    <TableCell>{new Date(a.detected_at).toLocaleString("sv-SE")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Break-glass sessions</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(breakGlassRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No break-glass sessions.
                  </TableCell>
                </TableRow>
              ) : (
                (breakGlassRes.data ?? []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {(b.tenants as unknown as { name: string } | null)?.name ?? "–"}
                    </TableCell>
                    <TableCell className="max-w-md truncate">{b.reason}</TableCell>
                    <TableCell>{b.scope}</TableCell>
                    <TableCell>
                      <StatusBadge color={b.status === "active" ? "red" : "gray"}>
                        {b.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{new Date(b.started_at).toLocaleString("sv-SE")}</TableCell>
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
