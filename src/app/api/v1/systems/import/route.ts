import ExcelJS from "exceljs";

import { withApi, ok, badRequest, forbidden } from "@/lib/api/handler";
import { hasPermission } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

/**
 * Excel import for the system register. Expects an .xlsx upload (multipart
 * form: file, tenantId) with a header row. Recognized columns (sv/en):
 * Namn/Name, Typ/Type, Miljö/Environment, Ägare/Owner, Informationsägare,
 * RTO, RPO, Sektorskritisk, Personuppgifter, Backup, Beskrivning.
 */
export const POST = withApi(async (req, { actor }) => {
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("multipart/form-data expected");

  const tenantId = String(form.get("tenantId") ?? "");
  const file = form.get("file");
  if (!tenantId || !(file instanceof File)) {
    throw badRequest("tenantId and file are required");
  }
  if (!hasPermission(actor, tenantId, "systems.write")) {
    throw forbidden("systems.write permission required");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw badRequest("Workbook has no sheets");

  const headerRow = sheet.getRow(1);
  const columns = new Map<string, number>();
  headerRow.eachCell((cell, col) => {
    const key = String(cell.value ?? "").trim().toLowerCase();
    if (key) columns.set(key, col);
  });

  const col = (...names: string[]): number | undefined => {
    for (const n of names) {
      const c = columns.get(n);
      if (c) return c;
    }
    return undefined;
  };

  const nameCol = col("namn", "name", "system");
  if (!nameCol) throw badRequest("Header row must contain 'Namn' or 'Name'");

  const text = (row: ExcelJS.Row, c?: number): string | null => {
    if (!c) return null;
    const v = row.getCell(c).value;
    return v === null || v === undefined ? null : String(v).trim() || null;
  };
  const num = (row: ExcelJS.Row, c?: number): number | null => {
    const t = text(row, c);
    if (t === null) return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const bool = (row: ExcelJS.Row, c?: number): boolean | null => {
    const t = text(row, c)?.toLowerCase();
    if (!t) return null;
    return ["ja", "yes", "true", "1", "x"].includes(t);
  };

  const rows: Record<string, unknown>[] = [];
  const errors: { row: number; message: string }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = text(row, nameCol);
    if (!name) {
      if (row.actualCellCount > 0) errors.push({ row: rowNumber, message: "Namn saknas" });
      return;
    }
    rows.push({
      tenant_id: tenantId,
      name,
      system_type: text(row, col("typ", "type")),
      environment: (() => {
        const t = text(row, col("miljö", "miljo", "environment"))?.toLowerCase();
        if (t?.startsWith("prod")) return "production";
        if (t?.startsWith("test")) return "test";
        if (t?.startsWith("dev") || t?.startsWith("utv")) return "dev";
        if (t?.startsWith("utb") || t?.startsWith("train")) return "training";
        return "production";
      })(),
      owner_name: text(row, col("ägare", "agare", "owner")),
      information_owner_name: text(row, col("informationsägare", "informationsagare", "information owner")),
      description: text(row, col("beskrivning", "description")),
      rto_hours: num(row, col("rto", "rto (h)")),
      rpo_hours: num(row, col("rpo", "rpo (h)")),
      sector_critical: bool(row, col("sektorskritisk", "sektorkritisk", "sector critical")) ?? false,
      personal_data: bool(row, col("personuppgifter", "personal data")),
      backup_status: (() => {
        const t = text(row, col("backup"))?.toLowerCase();
        if (!t) return null;
        if (["ok", "ja", "yes"].includes(t)) return "ok";
        if (["nej", "no", "saknas", "missing"].includes(t)) return "missing";
        return "unknown";
      })(),
      created_by: actor.userId,
    });
  });

  if (rows.length === 0) {
    throw badRequest("No importable rows found");
  }

  const admin = getAdminClient();
  const { data, error } = await admin.from("systems").insert(rows).select("id");
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId,
    actorUserId: actor.userId,
    action: "systems.imported",
    entityType: "system",
    newValue: { imported: data?.length ?? 0, skipped: errors.length, fileName: file.name },
  });

  return ok({ imported: data?.length ?? 0, errors }, { status: 201 });
});
