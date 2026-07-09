import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { createIncident } from "@/lib/services/incidents";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  const { data, error } = await admin
    .from("incidents")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

const createSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(10000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  incidentType: z.string().max(100).optional(),
  isOngoing: z.boolean().optional(),
  suspectedMalicious: z.boolean().optional(),
  supplierOrigin: z.boolean().optional(),
  personalDataPossiblyAffected: z.boolean().optional(),
  protectedInformationPossiblyAffected: z.boolean().optional(),
  incidentStartedAt: z.string().datetime({ offset: true }).optional(),
  incidentDetectedAt: z.string().datetime({ offset: true }).optional(),
  detectionMethod: z.string().max(500).optional(),
  systemIds: z.array(z.string().uuid()).optional(),
  criticalServiceIds: z.array(z.string().uuid()).optional(),
  vendorIds: z.array(z.string().uuid()).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, createSchema);
  if (!hasPermission(actor, input.tenantId, "incidents.write")) {
    throw forbidden("incidents.write permission required");
  }
  const incident = await createIncident(actor, input);
  return ok(incident, { status: 201 });
});
