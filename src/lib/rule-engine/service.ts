import "server-only";

import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";

import type { RegulatoryRule } from "./types";

interface RuleRow {
  id: string;
  rule_code: string;
  title_sv: string;
  description_sv: string | null;
  rule_type: RegulatoryRule["ruleType"];
  applicable_sectors: string[];
  applicable_subsectors: string[];
  applicable_entity_types: string[];
  applicable_classifications: string[];
  condition: RegulatoryRule["condition"];
  params: Record<string, unknown>;
  output: Record<string, unknown>;
  legal_reference: string | null;
  status: RegulatoryRule["status"];
  coverage_status: RegulatoryRule["coverageStatus"];
  confidence: RegulatoryRule["confidence"];
  required_approver_role: string | null;
  effective_from: string | null;
  effective_to: string | null;
  regulatory_rule_sets?: { code: string } | null;
}

export function mapRuleRow(row: RuleRow, ruleSetCode?: string): RegulatoryRule {
  return {
    id: row.id,
    ruleSetCode: ruleSetCode ?? row.regulatory_rule_sets?.code ?? "",
    ruleCode: row.rule_code,
    titleSv: row.title_sv,
    descriptionSv: row.description_sv,
    ruleType: row.rule_type,
    applicableSectors: row.applicable_sectors ?? [],
    applicableSubsectors: row.applicable_subsectors ?? [],
    applicableEntityTypes: row.applicable_entity_types ?? [],
    applicableClassifications: row.applicable_classifications ?? [],
    condition: row.condition,
    params: row.params ?? {},
    output: row.output ?? {},
    legalReference: row.legal_reference,
    status: row.status,
    coverageStatus: row.coverage_status,
    confidence: row.confidence,
    requiredApproverRole: row.required_approver_role,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  };
}

/** Loads all rules of the given rule sets (active + draft/pending marked as such). */
export async function loadRules(ruleSetCodes: string[]): Promise<RegulatoryRule[]> {
  if (ruleSetCodes.length === 0) return [];
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("regulatory_rules")
    .select("*, regulatory_rule_sets!inner(code)")
    .in("regulatory_rule_sets.code", ruleSetCodes)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RuleRow[]).map((row) => mapRuleRow(row));
}

/**
 * Publishes a new version of a rule set: snapshots all rules, records the
 * version, writes the change log and audit trail. Returns impacted tenants.
 */
export async function publishRuleSetVersion(
  actor: ActorContext,
  input: { ruleSetCode: string; version: string; changelog: string },
) {
  const admin = getAdminClient();

  const { data: ruleSet } = await admin
    .from("regulatory_rule_sets")
    .select("id, code, version")
    .eq("code", input.ruleSetCode)
    .maybeSingle();
  if (!ruleSet) throw new Error(`Rule set ${input.ruleSetCode} not found`);

  const { data: rules, error: rulesError } = await admin
    .from("regulatory_rules")
    .select("*")
    .eq("rule_set_id", ruleSet.id);
  if (rulesError) throw new Error(rulesError.message);

  const { error: versionError } = await admin.from("regulatory_rule_versions").insert({
    rule_set_id: ruleSet.id,
    version: input.version,
    snapshot: { rules: rules ?? [] },
    changelog: input.changelog,
    published_by: actor.userId,
  });
  if (versionError) throw new Error(versionError.message);

  await admin
    .from("regulatory_rule_versions")
    .update({ status: "superseded" })
    .eq("rule_set_id", ruleSet.id)
    .neq("version", input.version);

  await admin
    .from("regulatory_rule_sets")
    .update({ version: input.version })
    .eq("id", ruleSet.id);

  await admin.from("regulatory_change_logs").insert({
    rule_set_id: ruleSet.id,
    change_type: "published",
    summary: `Version ${input.version} published: ${input.changelog}`,
    changed_by: actor.userId,
  });

  await writeAuditLog({
    actorUserId: actor.userId,
    action: "rule_version.published",
    entityType: "regulatory_rule_set",
    entityId: ruleSet.id,
    previousValue: { version: ruleSet.version },
    newValue: { version: input.version, changelog: input.changelog },
  });

  const impacted = await getImpactedTenants(input.ruleSetCode);
  return { version: input.version, impactedTenants: impacted };
}

/** Tenants that have this rule set assigned — shown before publishing. */
export async function getImpactedTenants(ruleSetCode: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("tenant_rule_package_versions")
    .select("tenant_id, version, tenants(name, status)")
    .eq("rule_set_code", ruleSetCode)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const tenant = row.tenants as unknown as { name: string; status: string } | null;
    return {
      tenantId: row.tenant_id as string,
      currentVersion: row.version as string,
      name: tenant?.name ?? "",
      status: tenant?.status ?? "",
    };
  });
}
