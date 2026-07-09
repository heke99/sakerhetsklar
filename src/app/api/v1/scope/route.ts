import { z } from "zod";

import { withApi, ok, parseBody, forbidden, requireTenantIdParam } from "@/lib/api/handler";
import { hasPermission, isTenantMember } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { runScopeAssessment } from "@/lib/services/scope";

export const GET = withApi(async (req, { actor }) => {
  const tenantId = requireTenantIdParam(req);
  if (!isTenantMember(actor, tenantId)) throw forbidden();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("scope_results")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ok(data);
});

const answersSchema = z.object({
  tenantId: z.string().uuid(),
  entityType: z.enum([
    "private_company", "municipality", "region", "municipal_company",
    "state_agency", "other_public_body", "non_profit", "other",
  ]),
  sectors: z.array(z.string()).max(18),
  subsectors: z.array(z.string()).default([]),
  providesCriticalPublicServices: z.boolean().optional(),
  isDnsProvider: z.boolean().optional(),
  isTldRegistry: z.boolean().optional(),
  isTelecomProvider: z.boolean().optional(),
  isTrustServiceProvider: z.boolean().optional(),
  isCerEntity: z.boolean().optional(),
  suppliesCriticalEntities: z.boolean().optional(),
  handlesSecurityClassifiedInfo: z.boolean().optional(),
  isStateAgency: z.boolean().optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, answersSchema);
  if (!hasPermission(actor, input.tenantId, "scope.write")) {
    throw forbidden("scope.write permission required");
  }
  const { result, engineResult, packages, authorities } = await runScopeAssessment(
    actor,
    input.tenantId,
    input,
  );
  return ok({ result, engineResult, packages, authorities }, { status: 201 });
});
