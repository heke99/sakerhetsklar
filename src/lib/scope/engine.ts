import { evaluateRules } from "@/lib/rule-engine/evaluate";
import type { Facts, RegulatoryRule, RuleEvaluation } from "@/lib/rule-engine/types";

/**
 * Scope engine (spec §11 step 5): aggregates classification/coverage rule
 * evaluations into a rule profile. Never guesses — missing facts or
 * review-flagged rules produce manual_review, not silent assumptions.
 */

export type LikelyCovered = "yes" | "no" | "manual_review";
export type Classification = "essential" | "important" | "public" | "manual_review";

export interface ScopeFacts extends Facts {
  entity_type?: string;
  size_class?: string;
  sectors?: string[];
  subsectors?: string[];
  has_annex1_sector?: boolean;
  has_annex2_sector?: boolean;
  is_dns_provider?: boolean;
  is_tld_registry?: boolean;
  is_trust_service_provider?: boolean;
  is_telecom_provider?: boolean;
  is_cer_entity?: boolean;
  supplies_critical_entities?: boolean;
  handles_security_classified_info?: boolean;
}

export interface ScopeReason {
  ruleCode: string;
  titleSv: string;
  legalReference: string | null;
  textSv: string;
}

export interface ScopeEngineResult {
  likelyCovered: LikelyCovered;
  classification: Classification | null;
  manualReviewReasons: string[];
  flags: string[];
  uploadWarning: boolean;
  matchedRules: ScopeReason[];
  missingFacts: string[];
  confidence: "high" | "medium" | "low";
  evaluations: RuleEvaluation[];
}

interface ClassificationOutput {
  decision?: string;
  value?: string;
  priority?: number;
  likely_covered?: string;
  reason_sv?: string;
  upload_warning?: boolean;
}

export function runScopeEngine(
  rules: RegulatoryRule[],
  facts: ScopeFacts,
): ScopeEngineResult {
  const evaluations = evaluateRules(rules, facts);

  let best: { classification: Classification; priority: number } | null = null;
  const manualReviewReasons: string[] = [];
  const flags: string[] = [];
  const matchedRules: ScopeReason[] = [];
  const missingFacts = new Set<string>();
  let uploadWarning = false;
  let lowConfidence = false;

  for (const evaluation of evaluations) {
    const output = evaluation.rule.output as ClassificationOutput;

    if (evaluation.outcome === "missing_facts") {
      // Only classification/coverage rules block the result on missing facts.
      if (
        evaluation.rule.ruleType === "classification" ||
        evaluation.rule.ruleType === "coverage"
      ) {
        for (const f of evaluation.missingFacts) missingFacts.add(f);
      }
      continue;
    }
    if (evaluation.outcome !== "matched") continue;

    matchedRules.push({
      ruleCode: evaluation.rule.ruleCode,
      titleSv: evaluation.rule.titleSv,
      legalReference: evaluation.rule.legalReference,
      textSv: evaluation.rule.descriptionSv ?? evaluation.rule.titleSv,
    });

    if (evaluation.rule.confidence !== "high") lowConfidence = true;
    if (output.upload_warning) uploadWarning = true;

    if (output.decision === "classification" && output.value) {
      const priority = output.priority ?? 0;
      if (!best || priority > best.priority) {
        best = { classification: output.value as Classification, priority };
      }
    } else if (output.decision === "manual_review") {
      if (output.reason_sv) manualReviewReasons.push(output.reason_sv);
    } else if (output.decision === "flag") {
      if (output.reason_sv) flags.push(output.reason_sv);
    }

    // Draft/pending rules always force review of their result.
    if (
      evaluation.rule.status === "draft" ||
      evaluation.rule.status === "pending_guidance" ||
      evaluation.rule.coverageStatus === "requires_manual_review" ||
      evaluation.rule.coverageStatus === "pending_regulatory_guidance"
    ) {
      if (output.decision === "classification" && output.reason_sv) {
        manualReviewReasons.push(output.reason_sv);
      }
    }
  }

  let likelyCovered: LikelyCovered;
  let classification: Classification | null;

  if (best) {
    likelyCovered = "yes";
    classification = best.classification;
  } else if (manualReviewReasons.length > 0 || missingFacts.size > 0) {
    likelyCovered = "manual_review";
    classification = "manual_review";
    if (missingFacts.size > 0) {
      manualReviewReasons.push(
        `Uppgifter saknas för säker bedömning: ${[...missingFacts].join(", ")}.`,
      );
    }
  } else {
    likelyCovered = "no";
    classification = null;
  }

  // Manual review reasons on top of a definite classification keep the
  // classification but lower confidence.
  const confidence: ScopeEngineResult["confidence"] =
    likelyCovered === "manual_review"
      ? "low"
      : manualReviewReasons.length > 0 || lowConfidence
        ? "medium"
        : "high";

  return {
    likelyCovered,
    classification,
    manualReviewReasons,
    flags,
    uploadWarning,
    matchedRules,
    missingFacts: [...missingFacts],
    confidence,
    evaluations,
  };
}

/** Rule packages applicable to a scope result (data-driven assignment). */
export function deriveRulePackages(input: {
  likelyCovered: LikelyCovered;
  sectors: string[];
  entityType?: string;
  isTrustServiceProvider?: boolean;
  isCerEntity?: boolean;
  handlesSecurityClassifiedInfo?: boolean;
}): { active: string[]; pending: string[] } {
  const active = new Set<string>();
  const pending = new Set<string>();

  if (input.likelyCovered === "no") {
    return { active: [], pending: [] };
  }

  active.add("CSL_2025_1506");
  active.add("CSF_2025_1507");
  active.add("MCFFS_2026_1");
  active.add("MCFFS_2026_8");
  active.add("GDPR_PERSONAL_DATA_BREACH");
  active.add("CONTRACTUAL_REPORTING");
  active.add("CYBER_INSURANCE");
  // In force 1 October 2026 — pending until then.
  pending.add("MCFFS_2026_11");
  pending.add("MCFFS_2026_12");

  if (input.entityType === "state_agency") {
    active.add("MCFFS_2026_7");
  }

  const ptsSectors = [
    "digital_infrastructure",
    "digital_providers",
    "ict_b2b",
    "postal_courier",
    "space",
  ];
  if (input.sectors.some((s) => ptsSectors.includes(s))) {
    pending.add("PTS_RULE_TRACK");
    active.add("EU_2024_2690");
  }

  if (input.isTrustServiceProvider) {
    active.add("EIDAS_TRUST_SERVICE");
  }
  if (input.isCerEntity) {
    pending.add("CER_FLAG");
  }
  if (
    input.sectors.includes("banking") ||
    input.sectors.includes("financial_market_infrastructure")
  ) {
    pending.add("DORA_FLAG");
  }
  if (input.handlesSecurityClassifiedInfo) {
    pending.add("SECURITY_PROTECTION_FLAG");
  }

  return { active: [...active], pending: [...pending] };
}
