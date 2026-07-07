import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound, badRequest } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { setReportStatus, updateReportFields } from "@/lib/services/reports";

export const GET = withApi<{ id: string }>(async (_req, { actor, params }) => {
  const admin = getAdminClient();
  const { data: report, error } = await admin
    .from("incident_reports")
    .select(
      "*, incident_report_fields(*), incidents(reference, title), cyberportal_incident_ids(cyberportal_id, report_stage), report_receipts(*)",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!report) throw notFound("Report not found");
  if (!isTenantMember(actor, report.tenant_id)) throw forbidden();

  const { data: definitions } = await admin
    .from("report_field_definitions")
    .select("*")
    .eq("report_stage", report.report_stage)
    .eq("status", "active")
    .order("sort_order");

  return ok({ report, definitions: definitions ?? [] });
});

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  fields: z.record(z.string(), z.string()).optional(),
  status: z
    .enum([
      "ready_for_review", "approved", "submitted_in_cyberportalen",
      "cyberportal_incident_id_saved", "receipt_uploaded",
    ])
    .optional(),
  cyberportalId: z.string().max(200).optional(),
  overrideReason: z.string().max(2000).optional(),
  submissionMethod: z.enum(["cyberportalen", "reserve_procedure", "other"]).optional(),
});

export const PATCH = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, patchSchema);

  if (input.fields) {
    if (!hasPermission(actor, input.tenantId, "reports.write")) {
      throw forbidden("reports.write permission required");
    }
    await updateReportFields(actor, {
      tenantId: input.tenantId,
      reportId: params.id,
      fields: input.fields,
    });
  }

  if (input.status) {
    const needed =
      input.status === "approved"
        ? "reports.approve"
        : input.status === "submitted_in_cyberportalen" ||
            input.status === "cyberportal_incident_id_saved"
          ? "reports.mark_submitted"
          : "reports.write";
    if (!hasPermission(actor, input.tenantId, needed)) {
      throw forbidden(`${needed} permission required`);
    }
    try {
      const updated = await setReportStatus(actor, {
        tenantId: input.tenantId,
        reportId: params.id,
        status: input.status,
        cyberportalId: input.cyberportalId,
        overrideReason: input.overrideReason,
        submissionMethod: input.submissionMethod,
      });
      return ok(updated);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : "Status change failed");
    }
  }

  return ok({ updated: true });
});
