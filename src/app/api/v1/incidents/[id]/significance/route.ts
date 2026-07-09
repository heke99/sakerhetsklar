import { z } from "zod";

import { withApi, ok, parseBody, forbidden, requireTenantIdParam } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import {
  assessIncidentSignificance,
  approveSignificanceAssessment,
} from "@/lib/services/significance";

export const GET = withApi<{ id: string }>(async (req, { actor, params }) => {
  const tenantId = requireTenantIdParam(req);
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  const { data, error } = await admin
    .from("incident_significance_assessments")
    .select("*")
    .eq("incident_id", params.id)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  return ok(data);
});

const assessSchema = z.object({
  tenantId: z.string().uuid(),
  facts: z.record(z.string(), z.unknown()),
});

export const POST = withApi<{ id: string }>(async (req, { actor, params }) => {
  const input = await parseBody(req, assessSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.assess")) {
    throw forbidden("incidents.assess permission required");
  }
  const { assessment, result } = await assessIncidentSignificance(actor, {
    tenantId: input.tenantId,
    incidentId: params.id,
    facts: input.facts,
  });
  return ok({ assessment, result }, { status: 201 });
});

const approveSchema = z.object({
  tenantId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(2000).optional(),
});

export const PATCH = withApi<{ id: string }>(async (req, { actor }) => {
  const input = await parseBody(req, approveSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.approve")) {
    throw forbidden("incidents.approve permission required");
  }
  const updated = await approveSignificanceAssessment(actor, input);
  return ok(updated);
});
