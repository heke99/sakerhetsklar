import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPermission } from "@/lib/authz/context";
import { assertTenantEntity } from "@/lib/authz/tenant-guards";
import { saveSizeAssessment } from "@/lib/services/scope";

const sizeSchema = z.object({
  tenantId: z.string().uuid(),
  legalEntityId: z.string().uuid().optional(),
  employees: z.number().int().min(0),
  annualTurnoverEur: z.number().min(0).nullable().optional(),
  balanceSheetTotalEur: z.number().min(0).nullable().optional(),
  financialYear: z.number().int().min(2000).max(2100).optional(),
  includeGroup: z.boolean().optional(),
  groupEmployees: z.number().int().min(0).nullable().optional(),
  groupTurnoverEur: z.number().min(0).nullable().optional(),
  groupBalanceSheetTotalEur: z.number().min(0).nullable().optional(),
});

export const POST = withApi(async (req, { actor }) => {
  const input = await parseBody(req, sizeSchema);
  if (!hasPermission(actor, input.tenantId, "scope.write")) {
    throw forbidden("scope.write permission required");
  }
  if (input.legalEntityId) {
    await assertTenantEntity("legal_entities", input.legalEntityId, input.tenantId);
  }
  const { assessment, result } = await saveSizeAssessment(actor, input.tenantId, input);
  return ok({ assessment, result }, { status: 201 });
});
