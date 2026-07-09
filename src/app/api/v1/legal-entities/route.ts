import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPermission, hasTenantRole, isTenantMember } from "@/lib/authz/context";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) throw notFound("tenantId is required");
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  const { data, error } = await admin
    .from("legal_entities")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw new Error(error.message);
  return ok(data);
});

const createSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(200),
  organizationNumber: z.string().max(20).optional(),
  countryCode: z.string().length(2).default("SE"),
  entityType: z.string().max(100).optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, createSchema);
  if (
    !hasPermission(actor, input.tenantId, "legal_entities.write") &&
    !hasTenantRole(actor, input.tenantId, ["tenant_admin"])
  ) {
    throw forbidden("legal_entities.write permission required");
  }

  const admin = await getTenantDataPlaneClient(input.tenantId);
  const { data, error } = await admin
    .from("legal_entities")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      organization_number: input.organizationNumber ?? null,
      country_code: input.countryCode.toUpperCase(),
      entity_type: input.entityType ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "legal_entity.created",
    entityType: "legal_entity",
    entityId: data.id,
    newValue: { name: input.name },
  });

  return ok(data, { status: 201 });
});
