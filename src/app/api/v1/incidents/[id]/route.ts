import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { changeIncidentStatus } from "@/lib/services/incidents";

export const GET = withApi<{ id: string }>(async (_req, { actor, params }) => {
  const admin = getAdminClient();
  const { data: incident, error } = await admin
    .from("incidents")
    .select(
      `*,
       incident_events(*),
       incident_system_impacts(*, systems(name)),
       incident_service_impacts(*, critical_services(name)),
       incident_vendor_impacts(*, vendors(name)),
       incident_tasks(*),
       incident_comments(*),
       incident_decision_logs(*)`,
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!incident) throw notFound("Incident not found");
  if (!isTenantMember(actor, incident.tenant_id)) throw forbidden();
  return ok(incident);
});

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  status: z
    .enum(["new", "triage", "investigating", "contained", "resolved", "closed"])
    .optional(),
  reason: z.string().max(2000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const PATCH = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, patchSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden("incidents.write permission required");
  }

  const admin = getAdminClient();

  if (input.status) {
    const updated = await changeIncidentStatus(actor, {
      tenantId: input.tenantId,
      incidentId: params.id,
      toStatus: input.status,
      reason: input.reason,
    });
    return ok(updated);
  }

  if (input.severity) {
    const { data, error } = await admin
      .from("incidents")
      .update({ severity: input.severity, updated_by: actor.userId })
      .eq("id", params.id)
      .eq("tenant_id", input.tenantId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return ok(data);
  }

  return ok(null);
});
