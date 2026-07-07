import { z } from "zod";

import { withApi, ok, parseBody, forbidden, notFound } from "@/lib/api/handler";
import { hasPlatformRole } from "@/lib/authz/context";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";

const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      fact: z.string(),
      op: z.enum([
        "eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in",
        "contains", "exists", "is_true", "is_false",
      ]),
      value: z.unknown().optional(),
    }),
    z.object({ all: z.array(conditionSchema) }),
    z.object({ any: z.array(conditionSchema) }),
    z.object({ not: conditionSchema }),
  ]),
);

const ruleSchema = z.object({
  ruleCode: z.string().min(1).max(100),
  titleSv: z.string().min(1).max(300),
  titleEn: z.string().max(300).optional(),
  descriptionSv: z.string().max(5000).optional(),
  ruleType: z.enum([
    "coverage", "classification", "significance_threshold", "deadline",
    "reporting_requirement", "control_requirement", "flag", "recurring_incident",
  ]),
  applicableSectors: z.array(z.string()).default([]),
  applicableSubsectors: z.array(z.string()).default([]),
  applicableEntityTypes: z.array(z.string()).default([]),
  applicableClassifications: z.array(z.string()).default([]),
  condition: conditionSchema.nullable().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).default({}),
  legalReference: z.string().max(500).optional(),
  status: z
    .enum(["active", "draft", "pending_guidance", "replaced", "repealed", "archived"])
    .default("active"),
  coverageStatus: z
    .enum([
      "fully_supported", "partially_supported", "unsupported",
      "requires_manual_review", "pending_regulatory_guidance",
    ])
    .default("fully_supported"),
  confidence: z.enum(["high", "medium", "low"]).default("high"),
  requiredApproverRole: z.string().max(100).optional(),
  effectiveFrom: z.string().date().optional(),
  effectiveTo: z.string().date().optional(),
  sortOrder: z.number().int().default(0),
});

export const POST = withApi<{ code: string }>(async (req, { actor, params }) => {
  if (!hasPlatformRole(actor, ["platform_owner", "rule_admin"])) {
    throw forbidden("Only rule admins can create rules");
  }
  const input = await parseBody(req, ruleSchema);

  const admin = getAdminClient();
  const { data: ruleSet } = await admin
    .from("regulatory_rule_sets")
    .select("id, code")
    .eq("code", params.code)
    .maybeSingle();
  if (!ruleSet) throw notFound("Rule set not found");

  const { data, error } = await admin
    .from("regulatory_rules")
    .insert({
      rule_set_id: ruleSet.id,
      rule_code: input.ruleCode,
      title_sv: input.titleSv,
      title_en: input.titleEn ?? null,
      description_sv: input.descriptionSv ?? null,
      rule_type: input.ruleType,
      applicable_sectors: input.applicableSectors,
      applicable_subsectors: input.applicableSubsectors,
      applicable_entity_types: input.applicableEntityTypes,
      applicable_classifications: input.applicableClassifications,
      condition: input.condition ?? null,
      params: input.params,
      output: input.output,
      legal_reference: input.legalReference ?? null,
      status: input.status,
      coverage_status: input.coverageStatus,
      confidence: input.confidence,
      required_approver_role: input.requiredApproverRole ?? null,
      effective_from: input.effectiveFrom ?? null,
      effective_to: input.effectiveTo ?? null,
      sort_order: input.sortOrder,
      created_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await admin.from("regulatory_change_logs").insert({
    rule_set_id: ruleSet.id,
    rule_id: data.id,
    change_type: "created",
    summary: `Rule ${input.ruleCode} created`,
    new_value: { ruleCode: input.ruleCode, status: input.status },
    changed_by: actor.userId,
  });

  await writeAuditLog({
    actorUserId: actor.userId,
    action: "rule.created",
    entityType: "regulatory_rule",
    entityId: data.id,
    newValue: { ruleSet: params.code, ruleCode: input.ruleCode },
  });

  return ok(data, { status: 201 });
});
