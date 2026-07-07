import { PageHeader } from "@/components/app/page-header";
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
export const metadata = { title: "Audit log" };

export default async function PlatformAuditPage() {
  await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "security_admin",
    "readonly_auditor",
  ]);
  const admin = getAdminClient();

  const { data: logs } = await admin
    .from("audit_logs")
    .select("*, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main className="p-8">
      <PageHeader
        title="Audit log"
        description="Platform-wide audit trail of critical actions. Payloads are reduced — no evidence content or personal data."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(logs ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No audit entries yet.
                </TableCell>
              </TableRow>
            ) : (
              (logs ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("sv-SE")}
                  </TableCell>
                  <TableCell>{(l.tenants as { name: string } | null)?.name ?? "platform"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.action}</TableCell>
                  <TableCell className="font-mono text-xs">{l.entity_type}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {l.actor_user_id ? String(l.actor_user_id).slice(0, 8) : "system"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{l.reason ?? "–"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
