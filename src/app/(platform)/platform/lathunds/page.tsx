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
export const metadata = { title: "Lathunds" };

export default async function PlatformLathundsPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const { data: lathunds } = await admin
    .from("lathunds")
    .select("*, lathund_steps(id)")
    .order("sort_order");

  return (
    <main className="p-8">
      <PageHeader
        title="Lathund library"
        description="Platform-managed step-by-step guides delivered to all tenants. Versioned content with source references."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lathund</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Sources</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(lathunds ?? []).map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <p className="font-medium">{l.title_sv}</p>
                  <p className="font-mono text-xs text-muted-foreground">{l.code}</p>
                </TableCell>
                <TableCell>{((l.lathund_steps as { id: string }[]) ?? []).length}</TableCell>
                <TableCell className="font-mono text-xs">{l.version}</TableCell>
                <TableCell className="max-w-xs truncate text-xs">
                  {l.source_references ?? "–"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
