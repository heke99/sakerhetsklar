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
export const metadata = { title: "Support access" };

export default async function SupportAccessPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const { data: requests } = await admin
    .from("support_access_requests")
    .select("*, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="p-8">
      <PageHeader
        title="Support access"
        description="All support access is purpose-bound, time-limited, tenant-approved and fully logged."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Export</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(requests ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  No support access requests.
                </TableCell>
              </TableRow>
            ) : (
              (requests ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{(r.tenants as { name: string } | null)?.name ?? "–"}</TableCell>
                  <TableCell className="max-w-sm truncate">{r.purpose}</TableCell>
                  <TableCell>{r.scope}</TableCell>
                  <TableCell>{r.include_evidence ? "Yes" : "No"}</TableCell>
                  <TableCell>{r.allow_export ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      color={
                        r.status === "approved"
                          ? "yellow"
                          : r.status === "requested"
                            ? "blue"
                            : r.status === "denied" || r.status === "revoked"
                              ? "red"
                              : "gray"
                      }
                    >
                      {r.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{new Date(r.requested_at).toLocaleString("sv-SE")}</TableCell>
                  <TableCell>
                    {r.expires_at ? new Date(r.expires_at).toLocaleString("sv-SE") : "–"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
