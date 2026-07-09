import { z } from "zod";

import { withApi, ok, parseBody, forbidden, requireTenantIdParam } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { assertAllTenantEntities } from "@/lib/authz/tenant-guards";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = requireTenantIdParam(req);
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  const { data, error } = await admin
    .from("critical_services")
    .select("*, critical_service_systems(system_id, systems(name))")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return ok(data);
});

const serviceSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  sectorCode: z.string().max(100).optional(),
  isExternal: z.boolean().default(true),
  serviceOwnerName: z.string().max(200).optional(),
  affectedUsersEstimate: z.number().int().min(0).optional(),
  rtoHours: z.number().min(0).optional(),
  rpoHours: z.number().min(0).optional(),
  acceptableUnavailabilityHours: z.number().min(0).optional(),
  manualWorkaroundAvailable: z.boolean().optional(),
  manualWorkaroundMaxHours: z.number().min(0).optional(),
  recoveryPriority: z.number().int().min(1).max(100).optional(),
  systemIds: z.array(z.string().uuid()).default([]),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, serviceSchema);
  if (!hasPermission(actor, input.tenantId, "critical_services.write")) {
    throw forbidden("critical_services.write permission required");
  }
  await assertAllTenantEntities("systems", input.systemIds, input.tenantId);

  const admin = await getTenantDataPlaneClient(input.tenantId);
  const { data, error } = await admin
    .from("critical_services")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      sector_code: input.sectorCode ?? null,
      is_external: input.isExternal,
      service_owner_name: input.serviceOwnerName ?? null,
      affected_users_estimate: input.affectedUsersEstimate ?? null,
      rto_hours: input.rtoHours ?? null,
      rpo_hours: input.rpoHours ?? null,
      acceptable_unavailability_hours: input.acceptableUnavailabilityHours ?? null,
      manual_workaround_available: input.manualWorkaroundAvailable ?? null,
      manual_workaround_max_hours: input.manualWorkaroundMaxHours ?? null,
      recovery_priority: input.recoveryPriority ?? null,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (input.systemIds.length > 0) {
    await admin.from("critical_service_systems").insert(
      input.systemIds.map((systemId) => ({
        tenant_id: input.tenantId,
        critical_service_id: data.id,
        system_id: systemId,
      })),
    );
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "critical_service.created",
    entityType: "critical_service",
    entityId: data.id,
    newValue: { name: input.name },
  });

  return ok(data, { status: 201 });
});
