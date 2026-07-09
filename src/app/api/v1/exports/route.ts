import { withApi, badRequest, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission } from "@/lib/authz/context";
import { assertSupportAccessAllows } from "@/lib/authz/support-guards";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import { buildBoardReport, buildSupervisoryPackage } from "@/lib/exports/packages";

/**
 * Export generator: board report (pdf/docx) and supervisory package (zip).
 * All exports are authorized, logged and recorded.
 */
export const GET = withApi(async (req, { actor, meta }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const type = req.nextUrl.searchParams.get("type");
  const format = (req.nextUrl.searchParams.get("format") ?? "pdf") as "pdf" | "docx";

  if (!tenantId) throw notFound("tenantId is required");
  await assertSupportAccessAllows(actor, tenantId, "export");
  if (!hasPermission(actor, tenantId, "exports.generate")) {
    throw forbidden("exports.generate permission required");
  }

  const admin = getAdminClient();

  if (type === "board-report") {
    const { buffer, fileName } = await buildBoardReport(tenantId, format);
    await recordExport(tenantId, actor.userId, "board_report", format, meta.ipAddress);
    return fileResponse(
      buffer,
      fileName,
      format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf",
    );
  }

  if (type === "supervisory-package") {
    const { buffer, fileName, manifest } = await buildSupervisoryPackage(tenantId);
    await admin.from("audit_packages").insert({
      tenant_id: tenantId,
      package_type: "supervisory",
      manifest,
      generated_by: actor.userId,
    });
    await recordExport(tenantId, actor.userId, "supervisory_package", "zip", meta.ipAddress);
    return fileResponse(buffer, fileName, "application/zip");
  }

  if (type === "systems-excel" || type === "vendors-excel") {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type === "systems-excel" ? "System" : "Leverantörer");

    if (type === "systems-excel") {
      const { data } = await admin
        .from("systems")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("name");
      sheet.addRow(["Namn", "Typ", "Miljö", "Ägare", "Sektorskritisk", "RTO (h)", "RPO (h)", "Backup", "Personuppgifter"]);
      for (const s of data ?? []) {
        sheet.addRow([
          s.name, s.system_type, s.environment, s.owner_name,
          s.sector_critical ? "Ja" : "Nej", s.rto_hours, s.rpo_hours,
          s.backup_status, s.personal_data === true ? "Ja" : s.personal_data === false ? "Nej" : "",
        ]);
      }
    } else {
      const { data } = await admin
        .from("vendors")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("name");
      sheet.addRow(["Namn", "Org.nr", "Incidentkontakt", "24/7", "PUB-avtal", "Riskklass", "Dataresidens"]);
      for (const v of data ?? []) {
        sheet.addRow([
          v.name, v.organization_number, v.incident_contact_name ?? v.incident_contact_email,
          v.has_24_7_contact ? "Ja" : "Nej",
          v.dpa_exists === true ? "Ja" : v.dpa_exists === false ? "Nej" : "",
          v.risk_rating, v.data_residency,
        ]);
      }
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await recordExport(tenantId, actor.userId, type, "xlsx", meta.ipAddress);
    return fileResponse(
      buffer,
      type === "systems-excel" ? "systemregister.xlsx" : "leverantorsregister.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }

  throw badRequest("Unknown export type");

  async function recordExport(
    tenant: string,
    userId: string,
    exportType: string,
    fmt: string,
    ip: string | null,
  ) {
    await admin.from("exports").insert({
      tenant_id: tenant,
      export_type: exportType,
      format: fmt,
      generated_by: userId,
    });
    await admin.from("export_logs").insert({
      tenant_id: tenant,
      actor_user_id: userId,
      export_type: exportType,
      ip_address: ip,
    });
    await writeAuditLog({
      tenantId: tenant,
      actorUserId: userId,
      action: "export.generated",
      entityType: "export",
      newValue: { exportType, format: fmt },
      ipAddress: ip,
    });
  }
});

function fileResponse(buffer: Buffer, fileName: string, contentType: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
