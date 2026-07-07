import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("vendors")
    .select("*, subcontractors(id, name), vendor_risk_assessments(overall_risk, assessed_at)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return ok(data);
});

const vendorSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(200),
  organizationNumber: z.string().max(20).optional(),
  contactPerson: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  incidentContactName: z.string().max(200).optional(),
  incidentContactEmail: z.string().email().optional(),
  incidentContactPhone: z.string().max(50).optional(),
  has247Contact: z.boolean().default(false),
  servicesDescription: z.string().max(5000).optional(),
  slaSummary: z.string().max(2000).optional(),
  dataResidency: z.string().max(200).optional(),
  personalDataProcessor: z.boolean().optional(),
  dpaExists: z.boolean().optional(),
  certifications: z.array(z.string()).default([]),
  incidentReportingHours: z.number().min(0).optional(),
  rightToAudit: z.boolean().optional(),
  exitPlanExists: z.boolean().optional(),
  riskRating: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, vendorSchema);
  if (!hasPermission(actor, input.tenantId, "vendors.write")) {
    throw forbidden("vendors.write permission required");
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("vendors")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      organization_number: input.organizationNumber ?? null,
      contact_person: input.contactPerson ?? null,
      contact_email: input.contactEmail ?? null,
      incident_contact_name: input.incidentContactName ?? null,
      incident_contact_email: input.incidentContactEmail ?? null,
      incident_contact_phone: input.incidentContactPhone ?? null,
      has_24_7_contact: input.has247Contact,
      services_description: input.servicesDescription ?? null,
      sla_summary: input.slaSummary ?? null,
      data_residency: input.dataResidency ?? null,
      personal_data_processor: input.personalDataProcessor ?? null,
      dpa_exists: input.dpaExists ?? null,
      certifications: input.certifications,
      incident_reporting_hours: input.incidentReportingHours ?? null,
      right_to_audit: input.rightToAudit ?? null,
      exit_plan_exists: input.exitPlanExists ?? null,
      risk_rating: input.riskRating ?? null,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "vendor.created",
    entityType: "vendor",
    entityId: data.id,
    newValue: { name: input.name },
  });

  return ok(data, { status: 201 });
});
