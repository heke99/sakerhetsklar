import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { assertIncidentTenant } from "@/lib/authz/tenant-guards";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const incidentId = req.nextUrl.searchParams.get("incidentId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  let query = admin
    .from("incident_personal_data_assessments")
    .select("*, incidents(reference, title)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (incidentId) query = query.eq("incident_id", incidentId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ok(data);
});

const upsertSchema = z.object({
  tenantId: z.string().uuid(),
  incidentId: z.string().uuid(),
  personalDataInvolved: z.boolean().optional(),
  dataCategories: z.array(z.string()).optional(),
  specialCategories: z.boolean().optional(),
  dataSubjectsCount: z.number().int().min(0).optional(),
  disclosed: z.boolean().optional(),
  destroyed: z.boolean().optional(),
  altered: z.boolean().optional(),
  lost: z.boolean().optional(),
  unavailable: z.boolean().optional(),
  riskToRights: z.boolean().optional(),
  highRisk: z.boolean().optional(),
  imyNotificationRequired: z.boolean().optional(),
  dataSubjectNotificationRequired: z.boolean().optional(),
  awarenessAt: z.string().datetime({ offset: true }).optional(),
  notReportingReason: z.string().max(5000).optional(),
  lateReason: z.string().max(5000).optional(),
  dpoApprove: z.boolean().optional(),
  markSubmittedToImy: z.boolean().optional(),
  imyReference: z.string().max(200).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, upsertSchema);
  if (!hasPermission(actor, input.tenantId, "gdpr.write")) {
    throw forbidden("gdpr.write permission required");
  }
  await assertIncidentTenant(actor, input.incidentId, input.tenantId);

  const admin = getAdminClient();
  const { data: existing } = await admin
    .from("incident_personal_data_assessments")
    .select("*")
    .eq("incident_id", input.incidentId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const update: Record<string, unknown> = {
    tenant_id: input.tenantId,
    incident_id: input.incidentId,
    assessed_by: actor.userId,
  };
  const map: [keyof typeof input, string][] = [
    ["personalDataInvolved", "personal_data_involved"],
    ["dataCategories", "data_categories"],
    ["specialCategories", "special_categories"],
    ["dataSubjectsCount", "data_subjects_count"],
    ["disclosed", "disclosed"],
    ["destroyed", "destroyed"],
    ["altered", "altered"],
    ["lost", "lost"],
    ["unavailable", "unavailable"],
    ["riskToRights", "risk_to_rights"],
    ["highRisk", "high_risk"],
    ["imyNotificationRequired", "imy_notification_required"],
    ["dataSubjectNotificationRequired", "data_subject_notification_required"],
    ["awarenessAt", "awareness_at"],
    ["notReportingReason", "not_reporting_reason"],
    ["lateReason", "late_reason"],
  ];
  for (const [from, to] of map) {
    if (input[from] !== undefined) update[to] = input[from];
  }

  // Status derivation (spec §22): a not-reporting decision requires reason +
  // approver; reporting decision sets the 72h IMY deadline from awareness.
  let status = existing?.status ?? "assessment_in_progress";
  if (input.imyNotificationRequired === true) {
    status = "report_required";
    const awareness = input.awarenessAt ?? existing?.awareness_at;
    if (awareness) {
      update.imy_deadline_at = new Date(
        new Date(awareness).getTime() + 72 * 3600_000,
      ).toISOString();
    }
  } else if (input.imyNotificationRequired === false) {
    if (!input.notReportingReason && !existing?.not_reporting_reason) {
      throw forbidden("Beslut att inte anmäla kräver dokumenterad motivering.");
    }
    status = "not_report_required";
    update.not_reporting_approved_by = actor.userId;
  }
  if (input.dataSubjectNotificationRequired === true) {
    status = "data_subject_notification_required";
  }
  if (input.markSubmittedToImy) {
    status = "submitted_to_imy";
    update.submitted_to_imy_at = new Date().toISOString();
    await admin.from("imy_submission_records").insert({
      tenant_id: input.tenantId,
      incident_id: input.incidentId,
      submitted_by: actor.userId,
      imy_reference: input.imyReference ?? null,
    });
  }
  if (input.dpoApprove) {
    if (!hasPermission(actor, input.tenantId, "gdpr.approve")) {
      throw forbidden("gdpr.approve (DPO) permission required");
    }
    update.dpo_approved_by = actor.userId;
    update.dpo_approved_at = new Date().toISOString();
  }
  update.status = status;

  const { data, error } = await admin
    .from("incident_personal_data_assessments")
    .upsert(update, { onConflict: "incident_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: input.dpoApprove
      ? "gdpr.dpo_approved"
      : input.markSubmittedToImy
        ? "gdpr.submitted_to_imy"
        : "gdpr.assessment_updated",
    entityType: "incident_personal_data_assessment",
    entityId: data.id,
    newValue: { status, incidentId: input.incidentId },
    reason: input.notReportingReason ?? null,
  });

  return ok(data);
});
