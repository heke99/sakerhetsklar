import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { assertIncidentTenant } from "@/lib/authz/tenant-guards";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("eidas_reports")
    .select("*, incidents(reference, title)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

const upsertSchema = z.object({
  tenantId: z.string().uuid(),
  incidentId: z.string().uuid(),
  contentDraft: z.string().max(20000).optional(),
  markSubmitted: z.boolean().optional(),
  reference: z.string().max(200).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, upsertSchema);
  if (!hasPermission(actor, input.tenantId, "reports.write")) {
    throw forbidden("reports.write permission required");
  }
  await assertIncidentTenant(actor, input.incidentId, input.tenantId);

  const admin = getAdminClient();
  const { data: existing } = await admin
    .from("eidas_reports")
    .select("id")
    .eq("incident_id", input.incidentId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    incident_id: input.incidentId,
  };
  if (input.contentDraft !== undefined) payload.content_draft = input.contentDraft;
  if (input.markSubmitted) {
    payload.status = "submitted";
    payload.submitted_at = new Date().toISOString();
    payload.submitted_by = actor.userId;
    payload.reference = input.reference ?? null;
    await admin.from("pts_submission_records").insert({
      tenant_id: input.tenantId,
      incident_id: input.incidentId,
      submitted_by: actor.userId,
      reference: input.reference ?? null,
    });
  }

  const { data, error } = existing
    ? await admin.from("eidas_reports").update(payload).eq("id", existing.id).select().single()
    : await admin.from("eidas_reports").insert(payload).select().single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: input.markSubmitted ? "eidas.report_submitted" : "eidas.report_updated",
    entityType: "eidas_report",
    entityId: data.id,
    newValue: { incidentId: input.incidentId },
  });

  return ok(data);
});
