import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { assertIncidentTenant } from "@/lib/authz/tenant-guards";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi<{ id: string }>(async (req, { actor, params }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("recipient_notifications")
    .select("*")
    .eq("incident_id", params.id)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

const decisionSchema = z.object({
  tenantId: z.string().uuid(),
  affectedServices: z.string().max(2000).optional(),
  affectedRecipients: z.string().max(2000).optional(),
  requiredAction: z.string().max(2000).optional(),
  consequenceIfNoAction: z.string().max(2000).optional(),
  decision: z.enum([
    "inform_now",
    "wait_would_worsen_handling",
    "do_not_inform",
    "manual_review",
  ]),
  decisionReason: z.string().min(5).max(5000),
  messageDraft: z.string().max(10000).optional(),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, decisionSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden("incidents.write permission required");
  }
  await assertIncidentTenant(actor, params.id, input.tenantId);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("recipient_notifications")
    .insert({
      tenant_id: input.tenantId,
      incident_id: params.id,
      affected_services: input.affectedServices ?? null,
      affected_recipients: input.affectedRecipients ?? null,
      required_action: input.requiredAction ?? null,
      consequence_if_no_action: input.consequenceIfNoAction ?? null,
      decision: input.decision,
      decision_reason: input.decisionReason,
      message_draft: input.messageDraft ?? null,
      approved_by: actor.userId,
      approved_at: new Date().toISOString(),
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from("incident_decision_logs").insert({
    tenant_id: input.tenantId,
    incident_id: params.id,
    decision: `Mottagarinformation: ${input.decision}`,
    reason: input.decisionReason,
    approver_user_id: actor.userId,
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "recipient_notification.decided",
    entityType: "recipient_notification",
    entityId: data.id,
    newValue: { decision: input.decision, incidentId: params.id },
    reason: input.decisionReason,
  });

  return ok(data, { status: 201 });
});
