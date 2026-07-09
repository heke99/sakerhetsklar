import "server-only";

import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";
import { assertAllTenantEntities } from "@/lib/authz/tenant-guards";
import { notifyTenantEvent } from "@/lib/services/notify";

export interface CreateIncidentInput {
  tenantId: string;
  title: string;
  description?: string;
  severity: "low" | "medium" | "high" | "critical";
  incidentType?: string;
  isOngoing?: boolean;
  suspectedMalicious?: boolean;
  supplierOrigin?: boolean;
  personalDataPossiblyAffected?: boolean;
  protectedInformationPossiblyAffected?: boolean;
  incidentStartedAt?: string;
  incidentDetectedAt?: string;
  detectionMethod?: string;
  systemIds?: string[];
  criticalServiceIds?: string[];
  vendorIds?: string[];
}

export async function createIncident(actor: ActorContext, input: CreateIncidentInput) {
  const admin = await getTenantDataPlaneClient(input.tenantId);

  // Linked resources must belong to the same tenant — never trust raw IDs.
  await Promise.all([
    assertAllTenantEntities("systems", input.systemIds ?? [], input.tenantId),
    assertAllTenantEntities(
      "critical_services",
      input.criticalServiceIds ?? [],
      input.tenantId,
    ),
    assertAllTenantEntities("vendors", input.vendorIds ?? [], input.tenantId),
  ]);

  const { count } = await admin
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", input.tenantId);
  const reference = `INC-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: incident, error } = await admin
    .from("incidents")
    .insert({
      tenant_id: input.tenantId,
      reference,
      title: input.title,
      description: input.description ?? null,
      severity: input.severity,
      incident_type: input.incidentType ?? null,
      is_ongoing: input.isOngoing ?? true,
      suspected_malicious: input.suspectedMalicious ?? null,
      supplier_origin: input.supplierOrigin ?? null,
      personal_data_possibly_affected: input.personalDataPossiblyAffected ?? null,
      protected_information_possibly_affected:
        input.protectedInformationPossiblyAffected ?? null,
      incident_started_at: input.incidentStartedAt ?? null,
      incident_detected_at: input.incidentDetectedAt ?? new Date().toISOString(),
      incident_known_at: input.incidentDetectedAt ?? new Date().toISOString(),
      detection_method: input.detectionMethod ?? null,
      reported_by: actor.userId,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (input.systemIds?.length) {
    await admin.from("incident_system_impacts").insert(
      input.systemIds.map((systemId) => ({
        tenant_id: input.tenantId,
        incident_id: incident.id,
        system_id: systemId,
        started_at: input.incidentStartedAt ?? null,
      })),
    );
  }
  if (input.criticalServiceIds?.length) {
    await admin.from("incident_service_impacts").insert(
      input.criticalServiceIds.map((serviceId) => ({
        tenant_id: input.tenantId,
        incident_id: incident.id,
        critical_service_id: serviceId,
        started_at: input.incidentStartedAt ?? null,
      })),
    );
  }
  if (input.vendorIds?.length) {
    await admin.from("incident_vendor_impacts").insert(
      input.vendorIds.map((vendorId) => ({
        tenant_id: input.tenantId,
        incident_id: incident.id,
        vendor_id: vendorId,
      })),
    );
  }

  await admin.from("incident_events").insert({
    tenant_id: input.tenantId,
    incident_id: incident.id,
    event_type: "created",
    title: "Incident skapad",
    detail: input.title,
    created_by: actor.userId,
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "incident.created",
    entityType: "incident",
    entityId: incident.id,
    newValue: { reference, title: input.title, severity: input.severity },
  });

  await notifyTenantEvent({
    tenantId: input.tenantId,
    eventType: "incident.created",
    title: `Ny incident: ${reference}`,
    body: `${input.title} (allvarlighetsgrad: ${input.severity}).`,
    severity: input.severity === "critical" || input.severity === "high" ? "critical" : "warning",
    linkPath: `/app/incidents/${incident.id}`,
    entityType: "incident",
    entityId: incident.id,
    webhookPayload: { incidentId: incident.id, reference, severity: input.severity },
  });

  return incident;
}

export async function changeIncidentStatus(
  actor: ActorContext,
  input: { tenantId: string; incidentId: string; toStatus: string; reason?: string },
) {
  const admin = await getTenantDataPlaneClient(input.tenantId);
  const { data: incident } = await admin
    .from("incidents")
    .select("id, status, is_ongoing")
    .eq("id", input.incidentId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!incident) throw new Error("Incident not found");

  const update: Record<string, unknown> = {
    status: input.toStatus,
    updated_by: actor.userId,
  };
  if (input.toStatus === "resolved" || input.toStatus === "closed") {
    update.is_ongoing = false;
    update.incident_ended_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("incidents")
    .update(update)
    .eq("id", input.incidentId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from("incident_statuses").insert({
    tenant_id: input.tenantId,
    incident_id: input.incidentId,
    from_status: incident.status,
    to_status: input.toStatus,
    reason: input.reason ?? null,
    changed_by: actor.userId,
  });

  await admin.from("incident_events").insert({
    tenant_id: input.tenantId,
    incident_id: input.incidentId,
    event_type: "status_changed",
    title: `Status ändrad: ${incident.status} → ${input.toStatus}`,
    detail: input.reason ?? null,
    created_by: actor.userId,
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "incident.status_changed",
    entityType: "incident",
    entityId: input.incidentId,
    previousValue: { status: incident.status },
    newValue: { status: input.toStatus },
    reason: input.reason ?? null,
  });

  return data;
}
