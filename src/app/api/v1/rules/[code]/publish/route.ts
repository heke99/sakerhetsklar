import { z } from "zod";

import { withApi, ok, parseBody, forbidden } from "@/lib/api/handler";
import { hasPlatformRole } from "@/lib/authz/context";
import { publishRuleSetVersion, getImpactedTenants } from "@/lib/rule-engine/service";

const publishSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Semantic version required"),
  changelog: z.string().min(3).max(5000),
});

/** Preview impacted tenants before publishing. */
export const GET = withApi<{ code: string }>(async (_req, { actor, params }) => {
  if (!hasPlatformRole(actor, ["platform_owner", "rule_admin", "platform_admin"])) {
    throw forbidden();
  }
  const impacted = await getImpactedTenants(params.code);
  return ok({ impactedTenants: impacted });
});

export const POST = withApi<{ code: string }>(async (req, { actor, params }) => {
  if (!hasPlatformRole(actor, ["platform_owner", "rule_admin"])) {
    throw forbidden("Only rule admins can publish rule versions");
  }
  const input = await parseBody(req, publishSchema);
  const result = await publishRuleSetVersion(actor, {
    ruleSetCode: params.code,
    version: input.version,
    changelog: input.changelog,
  });
  return ok(result, { status: 201 });
});
