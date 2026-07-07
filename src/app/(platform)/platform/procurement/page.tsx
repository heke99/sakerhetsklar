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
export const metadata = { title: "Procurement" };

export default async function PlatformProcurementPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const { data: packages } = await admin
    .from("audit_packages")
    .select("*, tenants(name)")
    .in("package_type", ["procurement", "supervisory", "exit"])
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="p-8">
      <PageHeader
        title="Procurement and package templates"
        description="Template sources live in docs/procurement, docs/security, docs/deployment, docs/exit-plan and docs/accessibility. Generated packages per tenant are listed below."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Generated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(packages ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No packages generated yet.
                </TableCell>
              </TableRow>
            ) : (
              (packages ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {(p.tenants as unknown as { name: string } | null)?.name ?? "–"}
                  </TableCell>
                  <TableCell>{p.package_type}</TableCell>
                  <TableCell>{new Date(p.created_at).toLocaleString("sv-SE")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
