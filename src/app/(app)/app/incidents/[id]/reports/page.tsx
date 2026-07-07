import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type StatusColor } from "@/components/app/status-badge";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { CreateReportButtons } from "./create-report";

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

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  ready_for_review: "Klar för granskning",
  approved: "Godkänd",
  submitted_in_cyberportalen: "Markerad som inskickad",
  cyberportal_incident_id_saved: "Cyberportalen-ID sparat",
  receipt_uploaded: "Kvitto uppladdat",
  late: "Försenad",
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

export default async function IncidentReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { id } = await params;

  const admin = getAdminClient();
  const [incidentRes, reportsRes, tracksRes] = await Promise.all([
    admin
      .from("incidents")
      .select("id, reference, title, significance_status")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    admin
      .from("incident_reports")
      .select("*, cyberportal_incident_ids(cyberportal_id, report_stage)")
      .eq("incident_id", id)
      .eq("tenant_id", tenant.id)
      .order("created_at"),
    admin
      .from("incident_regulatory_tracks")
      .select("track_code, status")
      .eq("incident_id", id),
  ]);

  const incident = incidentRes.data;
  if (!incident) notFound();

  const trackCodes = new Set((tracksRes.data ?? []).map((t) => t.track_code));

  return (
    <main className="p-8">
      <PageHeader
        title={`Rapporter — ${incident.reference}`}
        description="Skapa rapportutkast per steg, granska, godkänn och för över till Cyberportalen via kopieringsläget. Spara ärende-ID och kvitto per steg."
      />

      <div className="mb-8 rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-2 font-medium">Rapportsteg</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Deadline</th>
              <th className="px-4 py-2 font-medium">Cyberportalen-ID</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(reportsRes.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-muted-foreground">
                  Inga rapportutkast ännu. Skapa nedan.
                </td>
              </tr>
            ) : (
              (reportsRes.data ?? []).map((r) => {
                const cpId = (
                  r.cyberportal_incident_ids as { cyberportal_id: string; report_stage: string }[]
                ).find((c) => c.report_stage === r.report_stage);
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {stageLabels[r.report_stage] ?? r.report_stage}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge color={statusColors[r.status] ?? "gray"}>
                        {statusLabels[r.status] ?? r.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      {r.due_at ? new Date(r.due_at).toLocaleString("sv-SE") : "–"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {cpId?.cyberportal_id ?? (
                        <StatusBadge color="yellow">Saknas</StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/reports/${r.id}`}
                        className="text-primary hover:underline"
                      >
                        Öppna
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <CreateReportButtons
        tenantId={tenant.id}
        incidentId={incident.id}
        existingStages={(reportsRes.data ?? []).map((r) => r.report_stage)}
        hasStateAgencyTrack={trackCodes.has("STATE_AGENCY")}
        hasGdprTrack={trackCodes.has("GDPR_IMY")}
        hasEidasTrack={trackCodes.has("EIDAS_PTS")}
      />

      <p className="mt-6 text-sm">
        <Link href={`/app/incidents/${incident.id}`} className="text-primary hover:underline">
          ← Tillbaka till incidenten
        </Link>
      </p>
    </main>
  );
}
