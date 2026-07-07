import { withApi, forbidden, notFound, badRequest } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import {
  generateReportDocx,
  generateReportPdf,
} from "@/lib/exports/report-export";
import { stageTitle, type ReportStage } from "@/lib/services/reports";

export const GET = withApi<{ id: string }>(async (req, { actor, params, meta }) => {
  const format = req.nextUrl.searchParams.get("format") ?? "pdf";
  if (format !== "pdf" && format !== "docx") throw badRequest("format must be pdf or docx");

  const admin = getAdminClient();
  const { data: report } = await admin
    .from("incident_reports")
    .select("*, incident_report_fields(field_key, value), incidents(reference, title), tenants(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!report) throw notFound("Report not found");
  if (!isTenantMember(actor, report.tenant_id)) throw forbidden();
  if (!hasPermission(actor, report.tenant_id, "exports.generate")) {
    throw forbidden("exports.generate permission required");
  }

  const { data: definitions } = await admin
    .from("report_field_definitions")
    .select("field_key, copy_label, label_sv, sort_order")
    .eq("report_stage", report.report_stage)
    .eq("status", "active")
    .order("sort_order");

  const values = new Map(
    (report.incident_report_fields as { field_key: string; value: string | null }[]).map(
      (f) => [f.field_key, f.value ?? ""],
    ),
  );

  const incident = report.incidents as unknown as { reference: string; title: string } | null;
  const tenant = report.tenants as unknown as { name: string } | null;

  const exportData = {
    title: stageTitle(report.report_stage as ReportStage),
    subtitle: incident ? `${incident.reference}: ${incident.title}` : "",
    organizationName: tenant?.name ?? "",
    reference: incident?.reference ?? "",
    generatedAt: new Date(),
    fields: (definitions ?? []).map((d) => ({
      label: d.copy_label ?? d.label_sv,
      value: values.get(d.field_key) ?? "",
    })),
    footer:
      "Genererad av Säkerhetsklar. Säkerhetsklar tillhandahåller beslutsstöd — det slutliga juridiska och regulatoriska ansvaret ligger kvar hos organisationen.",
  };

  const buffer =
    format === "docx"
      ? await generateReportDocx(exportData)
      : await generateReportPdf(exportData);

  await writeAuditLog({
    tenantId: report.tenant_id,
    actorUserId: actor.userId,
    action: "export.generated",
    entityType: "incident_report",
    entityId: report.id,
    newValue: { format, stage: report.report_stage },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const fileName = `${incident?.reference ?? "rapport"}-${report.report_stage}.${format}`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
