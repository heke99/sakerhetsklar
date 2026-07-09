import { z } from "zod";

import { withApi, ok, parseBody, forbidden, requireTenantIdParam } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { assertTenantEntity } from "@/lib/authz/tenant-guards";
import { getTenantDataPlaneClient } from "@/lib/server/data-plane";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = requireTenantIdParam(req);
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = await getTenantDataPlaneClient(tenantId);
  const { data, error } = await admin
    .from("risks")
    .select("*, risk_treatments(*)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ok(data);
});

const riskSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  ownerName: z.string().max(200).optional(),
  linkedSystemId: z.string().uuid().optional(),
  linkedVendorId: z.string().uuid().optional(),
});

function riskLevel(likelihood?: number, impact?: number): string | null {
  if (!likelihood || !impact) return null;
  const score = likelihood * impact;
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, riskSchema);
  if (!hasPermission(actor, input.tenantId, "risks.write")) {
    throw forbidden("risks.write permission required");
  }
  if (input.linkedSystemId) {
    await assertTenantEntity("systems", input.linkedSystemId, input.tenantId);
  }
  if (input.linkedVendorId) {
    await assertTenantEntity("vendors", input.linkedVendorId, input.tenantId);
  }

  const admin = await getTenantDataPlaneClient(input.tenantId);
  const { data, error } = await admin
    .from("risks")
    .insert({
      tenant_id: input.tenantId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      likelihood: input.likelihood ?? null,
      impact: input.impact ?? null,
      risk_level: riskLevel(input.likelihood, input.impact),
      owner_name: input.ownerName ?? null,
      linked_system_id: input.linkedSystemId ?? null,
      linked_vendor_id: input.linkedVendorId ?? null,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    action: "risk.created",
    entityType: "risk",
    entityId: data.id,
    newValue: { title: input.title, riskLevel: data.risk_level },
  });

  return ok(data, { status: 201 });
});
