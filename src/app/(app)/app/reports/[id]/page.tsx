import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { stageTitle, type ReportStage } from "@/lib/services/reports";

import { ReportEditor } from "./report-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rapport" };

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;
  const { id } = await params;

  const admin = getAdminClient();
  const { data: report } = await admin
    .from("incident_reports")
    .select(
      "*, incident_report_fields(field_key, value), incidents(id, reference, title), cyberportal_incident_ids(cyberportal_id, report_stage), report_receipts(*)",
    )
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!report) notFound();

  const { data: definitions } = await admin
    .from("report_field_definitions")
    .select("*")
    .eq("report_stage", report.report_stage)
    .eq("status", "active")
    .order("sort_order");

  const incident = report.incidents as unknown as {
    id: string;
    reference: string;
    title: string;
  } | null;

  const values = Object.fromEntries(
    (report.incident_report_fields as { field_key: string; value: string | null }[]).map(
      (f) => [f.field_key, f.value ?? ""],
    ),
  );

  const cpId = (
    report.cyberportal_incident_ids as { cyberportal_id: string; report_stage: string }[]
  ).find((c) => c.report_stage === report.report_stage);

  return (
    <main className="p-8">
      <PageHeader
        title={stageTitle(report.report_stage as ReportStage)}
        description={
          incident
            ? `${incident.reference}: ${incident.title}. Fyll i fälten, godkänn och för över till Cyberportalen med kopieringsläget.`
            : undefined
        }
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      <ReportEditor
        tenantId={tenant.id}
        reportId={report.id}
        incidentId={incident?.id ?? ""}
        status={report.status}
        dueAt={report.due_at}
        cyberportalId={cpId?.cyberportal_id ?? null}
        receipts={(report.report_receipts as { id: string; file_name: string }[]) ?? []}
        definitions={(definitions ?? []).map((d) => ({
          key: d.field_key,
          label: d.label_sv,
          copyLabel: d.copy_label ?? d.label_sv,
          type: d.field_type,
          required: d.required,
          helpText: d.help_text_sv,
          legalReference: d.legal_reference,
        }))}
        initialValues={values}
      />
    </main>
  );
}
