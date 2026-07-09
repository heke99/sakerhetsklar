import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, hasTenantRole, isTenantMember } from "@/lib/authz/context";
import {
  assertIncidentTenant,
  assertTenantEntity,
} from "@/lib/authz/tenant-guards";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("customer_contract_reporting_requirements")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("counterparty_name");
  if (error) throw new Error(error.message);
  return ok(data);
});

const requirementSchema = z.object({
  tenantId: z.string().uuid(),
  counterpartyName: z.string().min(1).max(200),
  contractReference: z.string().max(200).optional(),
  counterpartyKind: z.enum(["customer", "vendor"]).default("customer"),
  reportingSlaHours: z.number().min(0).optional(),
  contactEmail: z.string().email().optional(),
  messageTemplate: z.string().max(5000).optional(),
  vendorId: z.string().uuid().optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, requirementSchema);
  if (!hasTenantRole(actor, input.tenantId, ["tenant_admin", "ciso", "vendor_manager", "legal_compliance"])) {
    throw forbidden();
  }
  if (input.vendorId) {
    await assertTenantEntity("vendors", input.vendorId, input.tenantId);
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("customer_contract_reporting_requirements")
    .insert({
      tenant_id: input.tenantId,
      counterparty_name: input.counterpartyName,
      contract_reference: input.contractReference ?? null,
      counterparty_kind: input.counterpartyKind,
      reporting_sla_hours: input.reportingSlaHours ?? null,
      contact_email: input.contactEmail ?? null,
      message_template: input.messageTemplate ?? null,
      vendor_id: input.vendorId ?? null,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "contract_requirement.created",
    entityType: "customer_contract_reporting_requirement",
    entityId: data.id,
    newValue: { counterparty: input.counterpartyName },
  });

  return ok(data, { status: 201 });
});

const notifySchema = z.object({
  tenantId: z.string().uuid(),
  incidentId: z.string().uuid(),
  requirementId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const PATCH = withApi(async (req, { actor }) => {
  const input = await parseBody(req, notifySchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden();
  }
  await assertIncidentTenant(actor, input.incidentId, input.tenantId);
  if (input.requirementId) {
    await assertTenantEntity(
      "customer_contract_reporting_requirements",
      input.requirementId,
      input.tenantId,
    );
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("contractual_notification_deadlines")
    .insert({
      tenant_id: input.tenantId,
      incident_id: input.incidentId,
      requirement_id: input.requirementId ?? null,
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
    action: "contract.notification_recorded",
    entityType: "contractual_notification_deadline",
    entityId: data.id,
    newValue: { incidentId: input.incidentId },
  });

  return ok(data, { status: 201 });
});
