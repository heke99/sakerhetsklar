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
    .from("systems")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return ok(data);
});

const systemSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  systemType: z.string().max(100).optional(),
  environment: z.enum(["production", "test", "dev", "training"]).default("production"),
  ownerName: z.string().max(200).optional(),
  informationOwnerName: z.string().max(200).optional(),
  vendorId: z.string().uuid().optional(),
  hostingModel: z
    .enum(["on_premise", "private_cloud", "public_cloud", "saas", "hybrid", "outsourced"])
    .optional(),
  dataResidency: z.string().max(100).optional(),
  personalData: z.boolean().optional(),
  protectedInformation: z.boolean().optional(),
  sectorCritical: z.boolean().default(false),
  rtoHours: z.number().min(0).optional(),
  rpoHours: z.number().min(0).optional(),
  acceptableUnavailabilityHours: z.number().min(0).optional(),
  acceptableDegradedHours: z.number().min(0).optional(),
  backupStatus: z.enum(["ok", "partial", "missing", "unknown"]).optional(),
  mfaStatus: z.enum(["enforced", "partial", "missing", "unknown"]).optional(),
  loggingStatus: z.enum(["ok", "partial", "missing", "unknown"]).optional(),
  monitoringStatus: z.enum(["ok", "partial", "missing", "unknown"]).optional(),
  patchStatus: z.enum(["current", "behind", "critical_backlog", "unknown"]).optional(),
  riskRating: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, systemSchema);
  if (!hasPermission(actor, input.tenantId, "systems.write")) {
    throw forbidden("systems.write permission required");
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("systems")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      system_type: input.systemType ?? null,
      environment: input.environment,
      owner_name: input.ownerName ?? null,
      information_owner_name: input.informationOwnerName ?? null,
      vendor_id: input.vendorId ?? null,
      hosting_model: input.hostingModel ?? null,
      data_residency: input.dataResidency ?? null,
      personal_data: input.personalData ?? null,
      protected_information: input.protectedInformation ?? null,
      sector_critical: input.sectorCritical,
      rto_hours: input.rtoHours ?? null,
      rpo_hours: input.rpoHours ?? null,
      acceptable_unavailability_hours: input.acceptableUnavailabilityHours ?? null,
      acceptable_degraded_hours: input.acceptableDegradedHours ?? null,
      backup_status: input.backupStatus ?? null,
      mfa_status: input.mfaStatus ?? null,
      logging_status: input.loggingStatus ?? null,
      monitoring_status: input.monitoringStatus ?? null,
      patch_status: input.patchStatus ?? null,
      risk_rating: input.riskRating ?? null,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "system.created",
    entityType: "system",
    entityId: data.id,
    newValue: { name: input.name, sectorCritical: input.sectorCritical },
  });

  return ok(data, { status: 201 });
});
