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
export const metadata = { title: "Report templates" };

export default async function TemplatesPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const [templatesRes, fieldsRes] = await Promise.all([
    admin.from("report_templates").select("*").order("code"),
    admin.from("report_field_definitions").select("report_stage").eq("status", "active"),
  ]);

  const fieldCounts = new Map<string, number>();
  for (const f of fieldsRes.data ?? []) {
    fieldCounts.set(f.report_stage, (fieldCounts.get(f.report_stage) ?? 0) + 1);
  }

  return (
    <main className="p-8">
      <PageHeader
        title="Report templates"
        description="Report stages and their field definitions. Every field carries its source rule and legal reference — edit via the rule admin API."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(templatesRes.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <p className="font-medium">{t.name_sv}</p>
                  <p className="text-xs text-muted-foreground">{t.description_sv}</p>
                </TableCell>
                <TableCell className="font-mono text-xs">{t.report_stage}</TableCell>
                <TableCell>{fieldCounts.get(t.report_stage) ?? 0}</TableCell>
                <TableCell>
                  <StatusBadge color={t.status === "active" ? "green" : "gray"}>
                    {t.status}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
