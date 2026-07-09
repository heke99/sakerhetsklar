import { z } from "zod";

import { withApi, ok, parseBody, forbidden, requireTenantIdParam } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { createReportDraft } from "@/lib/services/reports";

export const GET = withApi<{ id: string }>(async (req, { actor, params }) => {
  const tenantId = requireTenantIdParam(req);
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  const { data, error } = await admin
    .from("incident_reports")
    .select("*, incident_report_fields(*), cyberportal_incident_ids(cyberportal_id, report_stage), report_receipts(*)")
    .eq("incident_id", params.id)
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return ok(data);
});

const createSchema = z.object({
  tenantId: z.string().uuid(),
  stage: z.enum([
    "early_warning_24h", "incident_notification_72h", "final_report",
    "situation_report", "state_agency_6h", "imy_report", "eidas_report",
  ]),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, createSchema);
  if (!hasPermission(actor, input.tenantId, "reports.write")) {
    throw forbidden("reports.write permission required");
  }
  const report = await createReportDraft(actor, {
    tenantId: input.tenantId,
    incidentId: params.id,
    stage: input.stage,
  });
  return ok(report, { status: 201 });
});
