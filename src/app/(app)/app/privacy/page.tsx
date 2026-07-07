import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
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
export const metadata = { title: "Dataskydd" };

const statusColors: Record<string, StatusColor> = {
  not_assessed: "gray",
  assessment_in_progress: "blue",
  report_required: "red",
  not_report_required: "green",
  submitted_to_imy: "green",
  late: "red",
  data_subject_notification_required: "yellow",
  data_subjects_notified: "green",
};

export default async function PrivacyPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [assessmentsRes, submissionsRes, anomaliesRes] = await Promise.all([
    admin
      .from("incident_personal_data_assessments")
      .select("*, incidents(reference, title)")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
    admin
      .from("imy_submission_records")
      .select("*, incidents(reference)")
      .eq("tenant_id", tenant.id)
      .order("submitted_at", { ascending: false })
      .limit(20),
    admin
      .from("privacy_anomaly_events")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Dataskydd (DPO-vy)"
        description="GDPR-personuppgiftsincidenter, IMY-anmälningar och integritetsavvikelser. GDPR-bedömningen är alltid separat från NIS2-rapporteringen."
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Personuppgiftsincidenter</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registrerade</TableHead>
                <TableHead>IMY-frist</TableHead>
                <TableHead>DPO-godkänd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assessmentsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Inga personuppgiftsincidentbedömningar.
                  </TableCell>
                </TableRow>
              ) : (
                (assessmentsRes.data ?? []).map((a) => {
                  const incident = a.incidents as unknown as {
                    reference: string;
                    title: string;
                  } | null;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link
                          href={`/app/incidents/${a.incident_id}/gdpr`}
                          className="font-medium text-primary hover:underline"
                        >
                          {incident?.reference ?? "–"}
                        </Link>
                        <p className="text-xs text-muted-foreground">{incident?.title}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge color={statusColors[a.status] ?? "gray"}>
                          {a.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{a.data_subjects_count ?? "–"}</TableCell>
                      <TableCell>
                        {a.imy_deadline_at
                          ? new Date(a.imy_deadline_at).toLocaleString("sv-SE")
                          : "–"}
                      </TableCell>
                      <TableCell>{a.dpo_approved_at ? "Ja" : "Nej"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">IMY-anmälningar</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Inskickad</TableHead>
                <TableHead>IMY-referens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(submissionsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Inga anmälningar till IMY registrerade.
                  </TableCell>
                </TableRow>
              ) : (
                (submissionsRes.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {(s.incidents as unknown as { reference: string } | null)?.reference ?? "–"}
                    </TableCell>
                    <TableCell>{new Date(s.submitted_at).toLocaleString("sv-SE")}</TableCell>
                    <TableCell className="font-mono text-xs">{s.imy_reference ?? "–"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Integritetsavvikelser</h2>
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          {(anomaliesRes.data ?? []).length === 0
            ? "Inga integritetsavvikelser upptäckta."
            : `${(anomaliesRes.data ?? []).length} avvikelser — se säkerhetsvyn.`}
        </div>
      </section>
    </main>
  );
}
