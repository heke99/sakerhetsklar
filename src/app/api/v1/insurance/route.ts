import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, hasTenantRole, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("insurance_policies")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

const policySchema = z.object({
  tenantId: z.string().uuid(),
  provider: z.string().min(1).max(200),
  policyNumber: z.string().max(100).optional(),
  incidentContact: z.string().max(500).optional(),
  notificationDeadlineHours: z.number().min(0).optional(),
  requiredEvidence: z.string().max(2000).optional(),
  coverageNotes: z.string().max(2000).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, policySchema);
  if (!hasTenantRole(actor, input.tenantId, ["tenant_admin", "ciso"])) {
    throw forbidden();
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("insurance_policies")
    .insert({
      tenant_id: input.tenantId,
      provider: input.provider,
      policy_number: input.policyNumber ?? null,
      incident_contact: input.incidentContact ?? null,
      notification_deadline_hours: input.notificationDeadlineHours ?? null,
      required_evidence: input.requiredEvidence ?? null,
      coverage_notes: input.coverageNotes ?? null,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "insurance_policy.created",
    entityType: "insurance_policy",
    entityId: data.id,
    newValue: { provider: input.provider },
  });

  return ok(data, { status: 201 });
});

const notifySchema = z.object({
  tenantId: z.string().uuid(),
  incidentId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const PATCH = withApi(async (req, { actor }) => {
  const input = await parseBody(req, notifySchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden();
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("insurance_notification_requirements")
    .insert({
      tenant_id: input.tenantId,
      incident_id: input.incidentId,
      policy_id: input.policyId ?? null,
      submitted_at: new Date().toISOString(),
      submitted_by: actor.userId,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "insurance.notification_recorded",
    entityType: "insurance_notification_requirement",
    entityId: data.id,
    newValue: { incidentId: input.incidentId },
  });

  return ok(data, { status: 201 });
});
