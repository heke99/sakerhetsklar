import "server-only";

import JSZip from "jszip";

import { getAdminClient } from "@/lib/server/supabase-admin";
import { computeReadiness } from "@/lib/services/readiness";

import { generateReportDocx, generateReportPdf, type ReportExportData } from "./report-export";

const FOOTER =
  "Genererad av Säkerhetsklar. Säkerhetsklar tillhandahåller beslutsstöd — det slutliga juridiska och regulatoriska ansvaret ligger kvar hos organisationen.";

/** Board report (spec §35): summary, readiness, risks, incidents, decisions. */
export async function buildBoardReport(
  tenantId: string,
  format: "pdf" | "docx",
): Promise<{ buffer: Buffer; fileName: string }> {
  const admin = getAdminClient();

  const [tenantRes, readiness, risksRes, incidentsRes, deadlinesRes, exercisesRes, trainingRes, approvalsRes] =
    await Promise.all([
      admin.from("tenants").select("name, organization_number").eq("id", tenantId).maybeSingle(),
      computeReadiness(tenantId),
      admin
        .from("risks")
        .select("title, risk_level, status")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      admin
        .from("incidents")
        .select("reference, title, status, severity, significance_status")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("incident_deadlines")
        .select("deadline_type, due_at, status")
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "missed"]),
      admin
        .from("exercise_runs")
        .select("created_at, score, status")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1),
      admin.from("management_training_records").select("id").eq("tenant_id", tenantId),
      admin
        .from("incident_significance_assessments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("approval_status", "pending"),
    ]);

  const risks = risksRes.data ?? [];
  const incidents = incidentsRes.data ?? [];
  const deadlines = deadlinesRes.data ?? [];
  const criticalRisks = risks.filter(
    (r) => (r.risk_level === "critical" || r.risk_level === "high") && r.status !== "closed",
  );
  const openIncidents = incidents.filter((i) => i.status !== "closed");
  const significant = incidents.filter(
    (i) => i.significance_status === "significant_reportable",
  );
  const missedDeadlines = deadlines.filter((d) => d.status === "missed");

  const data: ReportExportData = {
    title: "Styrelserapport — cybersäkerhet och NIS2",
    subtitle: tenantRes.data?.name ?? "",
    organizationName: tenantRes.data?.name ?? "",
    reference: tenantRes.data?.organization_number ?? "",
    generatedAt: new Date(),
    fields: [
      {
        label: "Sammanfattning",
        value:
          `NIS2-readiness ${readiness.nis2Readiness} %. Rapporteringsberedskap ${readiness.reportingReadiness} %. ` +
          `Tillsynsberedskap ${readiness.supervisoryReadiness} %. ${openIncidents.length} öppna incidenter, ` +
          `${significant.length} betydande. ${missedDeadlines.length} missade rapporteringsdeadlines.`,
      },
      {
        label: "Readiness",
        value:
          `NIS2: ${readiness.nis2Readiness} % · Rapportering: ${readiness.reportingReadiness} % · ` +
          `Tillsyn: ${readiness.supervisoryReadiness} % · Ledning: ${readiness.managementReadiness} % · ` +
          `Leverantörer: ${readiness.supplierReadiness} % · Incident: ${readiness.incidentReadiness} %`,
      },
      {
        label: "Riskläge",
        value:
          risks.length === 0
            ? "Inga registrerade risker."
            : `${risks.length} risker totalt, varav ${criticalRisks.length} höga/kritiska öppna: ` +
              criticalRisks.map((r) => r.title).slice(0, 10).join("; "),
      },
      {
        label: "Incidenter",
        value:
          incidents.length === 0
            ? "Inga incidenter registrerade."
            : incidents
                .slice(0, 10)
                .map((i) => `${i.reference} ${i.title} (${i.status}, ${i.significance_status})`)
                .join("\n"),
      },
      {
        label: "Deadlines",
        value:
          deadlines.length === 0
            ? "Inga öppna rapporteringsdeadlines."
            : deadlines
                .map(
                  (d) =>
                    `${d.deadline_type}: ${new Date(d.due_at).toLocaleString("sv-SE")} (${d.status})`,
                )
                .join("\n"),
      },
      {
        label: "Ledningens utbildning",
        value: `${(trainingRes.data ?? []).length} utbildningsinsatser registrerade.`,
      },
      {
        label: "Senaste övning",
        value: exercisesRes.data?.[0]
          ? `${new Date(exercisesRes.data[0].created_at).toLocaleDateString("sv-SE")} (poäng: ${exercisesRes.data[0].score ?? "–"})`
          : "Ingen övning genomförd.",
      },
      {
        label: "Beslut som väntar på ledningen",
        value: `${(approvalsRes.data ?? []).length} betydande-bedömningar väntar på godkännande.`,
      },
    ],
    footer: FOOTER,
  };

  const buffer = format === "docx" ? await generateReportDocx(data) : await generateReportPdf(data);
  return { buffer, fileName: `styrelserapport.${format}` };
}

/** Supervisory audit package (spec §45): full ZIP with manifest. */
export async function buildSupervisoryPackage(tenantId: string): Promise<{
  buffer: Buffer;
  fileName: string;
  manifest: Record<string, number>;
}> {
  const admin = getAdminClient();
  const zip = new JSZip();

  const sections: { name: string; query: PromiseLike<{ data: unknown[] | null }> }[] = [
    { name: "scope-profile", query: admin.from("scope_results").select("*").eq("tenant_id", tenantId) },
    { name: "classification", query: admin.from("essential_important_classifications").select("*").eq("tenant_id", tenantId) },
    { name: "supervisory-authorities", query: admin.from("tenant_supervisory_authorities").select("*").eq("tenant_id", tenantId) },
    { name: "rule-packages", query: admin.from("tenant_rule_package_versions").select("*").eq("tenant_id", tenantId) },
    { name: "controls", query: admin.from("controls").select("*").eq("tenant_id", tenantId).is("deleted_at", null) },
    { name: "risk-register", query: admin.from("risks").select("*").eq("tenant_id", tenantId).is("deleted_at", null) },
    { name: "system-register", query: admin.from("systems").select("*").eq("tenant_id", tenantId).is("deleted_at", null) },
    { name: "critical-services", query: admin.from("critical_services").select("*").eq("tenant_id", tenantId).is("deleted_at", null) },
    { name: "vendors", query: admin.from("vendors").select("*").eq("tenant_id", tenantId).is("deleted_at", null) },
    { name: "incidents", query: admin.from("incidents").select("*").eq("tenant_id", tenantId).is("deleted_at", null) },
    { name: "significance-assessments", query: admin.from("incident_significance_assessments").select("*").eq("tenant_id", tenantId) },
    { name: "reports", query: admin.from("incident_reports").select("*, incident_report_fields(*)").eq("tenant_id", tenantId) },
    { name: "cyberportal-ids", query: admin.from("cyberportal_incident_ids").select("*").eq("tenant_id", tenantId) },
    { name: "report-receipts", query: admin.from("report_receipts").select("*").eq("tenant_id", tenantId) },
    { name: "decisions", query: admin.from("incident_decision_logs").select("*").eq("tenant_id", tenantId) },
    { name: "war-room-decisions", query: admin.from("war_room_decisions").select("*").eq("tenant_id", tenantId) },
    { name: "late-reporting", query: admin.from("late_reporting_records").select("*").eq("tenant_id", tenantId) },
    { name: "training-records", query: admin.from("management_training_records").select("*").eq("tenant_id", tenantId) },
    { name: "action-plans", query: admin.from("action_plans").select("*").eq("tenant_id", tenantId) },
    { name: "gdpr-assessments", query: admin.from("incident_personal_data_assessments").select("*").eq("tenant_id", tenantId) },
    {
      name: "evidence-manifest",
      query: admin
        .from("evidence")
        .select("id, file_name, evidence_type, classification, hash_sha256, uploaded_at, incident_id, control_id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
    },
  ];

  const manifest: Record<string, number> = {};
  for (const section of sections) {
    const { data } = await section.query;
    const rows = data ?? [];
    manifest[section.name] = rows.length;
    zip.file(`${section.name}.json`, JSON.stringify(rows, null, 2));
  }

  zip.file(
    "MANIFEST.json",
    JSON.stringify(
      {
        package: "supervisory-audit-package",
        generatedAt: new Date().toISOString(),
        tenantId,
        sections: manifest,
        note: FOOTER,
      },
      null,
      2,
    ),
  );
  zip.file("README.txt", `Tillsynspaket genererat av Säkerhetsklar.\n\n${FOOTER}\n`);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer: Buffer.from(buffer), fileName: "tillsynspaket.zip", manifest };
}
