import Link from "next/link";
import { redirect } from "next/navigation";

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
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rapporter" };

const statusColors: Record<string, StatusColor> = {
  draft: "gray",
  ready_for_review: "blue",
  approved: "green",
  submitted_in_cyberportalen: "green",
  cyberportal_incident_id_saved: "green",
  receipt_uploaded: "green",
  late: "red",
};

const stageLabels: Record<string, string> = {
  early_warning_24h: "Upplysning (24h)",
  incident_notification_72h: "Incidentanmälan (72h)",
  final_report: "Slutrapport",
  situation_report: "Lägesrapport",
  state_agency_6h: "Statlig varning (6h)",
  imy_report: "Anmälan till IMY",
  eidas_report: "eIDAS-rapport",
};

export default async function ReportsPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const { data: reports } = await admin
    .from("incident_reports")
    .select("*, incidents(reference, title)")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  return (
    <main className="p-8">
      <PageHeader
        title="Rapporter"
        description="Alla rapportutkast och inskickade rapporter per incident och rapportsteg."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Incident</TableHead>
              <TableHead>Rapportsteg</TableHead>
              <TableHead>Spår</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(reports ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Inga rapporter ännu. Rapporter skapas från incidentens rapportsida.
                </TableCell>
              </TableRow>
            ) : (
              (reports ?? []).map((r) => {
                const incident = r.incidents as unknown as {
                  reference: string;
                  title: string;
                } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/app/reports/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {incident?.reference ?? "–"}
                      </Link>
                      <p className="text-xs text-muted-foreground">{incident?.title}</p>
                    </TableCell>
                    <TableCell>{stageLabels[r.report_stage] ?? r.report_stage}</TableCell>
                    <TableCell className="font-mono text-xs">{r.track_code}</TableCell>
                    <TableCell>
                      <StatusBadge color={statusColors[r.status] ?? "gray"}>
                        {r.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {r.due_at ? new Date(r.due_at).toLocaleString("sv-SE") : "–"}
                    </TableCell>
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
