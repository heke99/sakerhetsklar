import "server-only";

import { getAdminClient } from "@/lib/server/supabase-admin";
import { writeAuditLog } from "@/lib/audit/log";
import type { ActorContext } from "@/lib/authz/context";
import { loadRules } from "@/lib/rule-engine/service";
import {
  deriveRulePackages,
  runScopeEngine,
  type ScopeFacts,
} from "@/lib/scope/engine";
import { assessSize, type SizeInput } from "@/lib/size-engine/size-engine";

export interface ScopeAnswers {
  entityType: string;
  sectors: string[];
  subsectors: string[];
  providesCriticalPublicServices?: boolean;
  isDnsProvider?: boolean;
  isTldRegistry?: boolean;
  isTelecomProvider?: boolean;
  isTrustServiceProvider?: boolean;
  isCerEntity?: boolean;
  suppliesCriticalEntities?: boolean;
  handlesSecurityClassifiedInfo?: boolean;
  isStateAgency?: boolean;
}

export async function saveSizeAssessment(
  actor: ActorContext,
  tenantId: string,
  input: SizeInput & { financialYear?: number; legalEntityId?: string },
) {
  const result = assessSize(input);
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("entity_size_assessments")
    .insert({
      tenant_id: tenantId,
      legal_entity_id: input.legalEntityId ?? null,
      employees: input.employees,
      annual_turnover_eur: input.annualTurnoverEur ?? null,
      balance_sheet_total_eur: input.balanceSheetTotalEur ?? null,
      financial_year: input.financialYear ?? null,
      group_employees: input.groupEmployees ?? null,
      group_turnover_eur: input.groupTurnoverEur ?? null,
      group_balance_sheet_total_eur: input.groupBalanceSheetTotalEur ?? null,
      include_group: Boolean(input.includeGroup),
      size_class: result.sizeClass,
      calculation: result,
      assessed_by: actor.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId,
    actorUserId: actor.userId,
    action: "scope.size_assessed",
    entityType: "entity_size_assessment",
    entityId: data.id,
    newValue: { sizeClass: result.sizeClass },
  });

  return { assessment: data, result };
}

/**
 * Runs the full scope assessment: builds facts from answers + latest size
 * assessment, evaluates DB rules, stores the result, assigns rule packages
 * and supervisory authorities, and updates onboarding.
 */
export async function runScopeAssessment(
  actor: ActorContext,
  tenantId: string,
  answers: ScopeAnswers,
) {
  const admin = getAdminClient();

  // Latest size assessment provides size_class facts.
  const { data: sizeRow } = await admin
    .from("entity_size_assessments")
    .select("size_class")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sector reference: which of the selected sectors are annex 1/2.
  const { data: sectorRows } = await admin
    .from("sectors")
    .select("code, annex")
    .in("code", answers.sectors.length > 0 ? answers.sectors : ["__none__"]);

  const annex1 = (sectorRows ?? []).filter((s) => s.annex === "annex_1").map((s) => s.code);
  const annex2 = (sectorRows ?? []).filter((s) => s.annex === "annex_2").map((s) => s.code);

  const facts: ScopeFacts = {
    entity_type: answers.entityType,
    size_class: sizeRow?.size_class ?? undefined,
    sectors: answers.sectors,
    subsectors: answers.subsectors,
    has_annex1_sector: annex1.length > 0,
    has_annex2_sector: annex2.length > 0,
    provides_critical_public_services: answers.providesCriticalPublicServices ?? false,
    is_dns_provider: answers.isDnsProvider ?? false,
    is_tld_registry: answers.isTldRegistry ?? false,
    is_telecom_provider: answers.isTelecomProvider ?? false,
    is_trust_service_provider: answers.isTrustServiceProvider ?? false,
    is_cer_entity: answers.isCerEntity ?? false,
    supplies_critical_entities: answers.suppliesCriticalEntities ?? false,
    handles_security_classified_info: answers.handlesSecurityClassifiedInfo ?? false,
  };

  const rules = await loadRules([
    "CSL_2025_1506",
    "CER_FLAG",
    "DORA_FLAG",
    "SECURITY_PROTECTION_FLAG",
  ]);

  const engineResult = runScopeEngine(rules, facts);
  const packages = deriveRulePackages({
    likelyCovered: engineResult.likelyCovered,
    sectors: answers.sectors,
    entityType: answers.entityType,
    isTrustServiceProvider: answers.isTrustServiceProvider,
    isCerEntity: answers.isCerEntity,
    handlesSecurityClassifiedInfo: answers.handlesSecurityClassifiedInfo,
  });

  // Supervisory authorities from mapping table.
  const { data: authorityRows } = await admin
    .from("sector_supervisory_authorities")
    .select("authority_code, sector_code")
    .in("sector_code", answers.sectors.length > 0 ? answers.sectors : ["__none__"]);
  const authorities = [...new Set((authorityRows ?? []).map((a) => a.authority_code))];

  // Persist assessment + answers + result.
  await admin
    .from("scope_assessments")
    .update({ status: "superseded" })
    .eq("tenant_id", tenantId)
    .eq("status", "completed");

  const { data: assessment, error: assessmentError } = await admin
    .from("scope_assessments")
    .insert({
      tenant_id: tenantId,
      status: "completed",
      started_by: actor.userId,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (assessmentError) throw new Error(assessmentError.message);

  const answerRows = Object.entries(answers).map(([key, value]) => ({
    assessment_id: assessment.id,
    tenant_id: tenantId,
    question_key: key,
    answer: JSON.parse(JSON.stringify({ value })),
    answered_by: actor.userId,
  }));
  await admin.from("scope_answers").insert(answerRows);

  const { data: result, error: resultError } = await admin
    .from("scope_results")
    .insert({
      assessment_id: assessment.id,
      tenant_id: tenantId,
      likely_covered: engineResult.likelyCovered,
      classification: engineResult.classification,
      sectors: answers.sectors,
      subsectors: answers.subsectors,
      supervisory_authorities: authorities,
      active_rule_packages: packages.active,
      pending_rule_packages: packages.pending,
      manual_review_reasons: engineResult.manualReviewReasons,
      matched_rules: engineResult.matchedRules,
      reasons: engineResult.matchedRules.map((r) => r.textSv),
      confidence: engineResult.confidence,
      next_steps: buildNextSteps(engineResult.likelyCovered, packages.active),
    })
    .select()
    .single();
  if (resultError) throw new Error(resultError.message);

  // Classification record (draft until approved by legal/compliance).
  await admin
    .from("essential_important_classifications")
    .update({ status: "superseded" })
    .eq("tenant_id", tenantId)
    .eq("status", "draft");
  await admin.from("essential_important_classifications").insert({
    tenant_id: tenantId,
    classification: engineResult.classification ?? "not_covered",
    basis: engineResult.matchedRules,
    matched_rules: engineResult.matchedRules,
    decided_by: actor.userId,
    status: "draft",
  });

  // Assign supervisory authorities.
  for (const code of authorities) {
    await admin.from("tenant_supervisory_authorities").upsert(
      {
        tenant_id: tenantId,
        authority_code: code,
        source_reference: "CSF 2025:1507",
        created_by: actor.userId,
      },
      { onConflict: "tenant_id,authority_code,sector_code", ignoreDuplicates: true },
    );
  }

  // Assign rule packages (versioned).
  const allPackages = [...packages.active, ...packages.pending];
  if (allPackages.length > 0) {
    const { data: ruleSets } = await admin
      .from("regulatory_rule_sets")
      .select("code, version")
      .in("code", allPackages);
    for (const rs of ruleSets ?? []) {
      await admin.from("tenant_rule_package_versions").upsert(
        {
          tenant_id: tenantId,
          rule_set_code: rs.code,
          version: rs.version,
          assigned_by: actor.userId,
          status: "active",
        },
        { onConflict: "tenant_id,rule_set_code,version", ignoreDuplicates: true },
      );
    }
  }

  // Onboarding progress.
  await admin.from("onboarding_progress").upsert(
    {
      tenant_id: tenantId,
      step_key: "sector_assessment",
      status: "completed",
      completed_by: actor.userId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,step_key" },
  );
  await admin.from("onboarding_progress").upsert(
    {
      tenant_id: tenantId,
      step_key: "rule_profile",
      status: "completed",
      completed_by: actor.userId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,step_key" },
  );
  await admin
    .from("tenants")
    .update({ onboarding_status: "in_progress" })
    .eq("id", tenantId)
    .eq("onboarding_status", "not_started");

  await writeAuditLog({
    tenantId,
    actorUserId: actor.userId,
    action: "scope.assessment_completed",
    entityType: "scope_result",
    entityId: result.id,
    newValue: {
      likelyCovered: engineResult.likelyCovered,
      classification: engineResult.classification,
      sectors: answers.sectors,
      confidence: engineResult.confidence,
    },
  });

  return { assessment, result, engineResult, packages, authorities };
}

function buildNextSteps(likelyCovered: string, activePackages: string[]): string[] {
  const steps: string[] = [];
  if (likelyCovered === "yes") {
    steps.push("Registrera verksamheten enligt MCFFS 2026:1 (aktiv från 2 februari 2026).");
    steps.push("Utse incidentroller och Cyberportalen-ansvarig.");
    steps.push("Dokumentera kritiska system och tjänster.");
    if (activePackages.includes("MCFFS_2026_7")) {
      steps.push("Säkerställ rutin för statlig it-incidentrapportering (MCFFS 2026:7).");
    }
  } else if (likelyCovered === "manual_review") {
    steps.push("Boka juridisk genomgång av omfattningsbedömningen.");
    steps.push("Komplettera saknade uppgifter och kör bedömningen igen.");
  } else {
    steps.push("Ingen registreringsplikt identifierad. Dokumentera bedömningen.");
    steps.push("Kontrollera avtalskrav från kunder som omfattas.");
  }
  return steps;
}
