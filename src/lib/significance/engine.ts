import { evaluateRules } from "@/lib/rule-engine/evaluate";
import type { Facts, RegulatoryRule } from "@/lib/rule-engine/types";

/**
 * Multi-track incident significance engine (spec §15). Aggregates rule
 * evaluations from all applicable rule packages into a recommendation with
 * matched rules, plain-language reasons, legal references, confidence,
 * required approvers, next steps and deadline definitions.
 */

export type SignificanceRecommendation =
  | "not_reportable"
  | "monitor"
  | "potentially_significant"
  | "significant_reportable"
  | "manual_review_required";

export interface MatchedRuleSummary {
  ruleSetCode: string;
  ruleCode: string;
  titleSv: string;
  reasonSv: string;
  legalReference: string | null;
  coverageStatus: string;
  status: string;
}

export interface DeadlineDefinition {
  deadlineType: string;
  hoursFromSignificant?: number;
  daysFromNotification?: number;
  legalReference: string | null;
  titleSv: string;
}

export interface SignificanceResult {
  recommendation: SignificanceRecommendation;
  ruleCoveragePartial: boolean;
  alsoAssess: {
    gdpr: boolean;
    pts: boolean;
    eidas: boolean;
    contracts: boolean;
    insurance: boolean;
    stateAgency: boolean;
  };
  matchedRules: MatchedRuleSummary[];
  reasons: string[];
  missingFacts: string[];
  legalReferences: string[];
  confidence: "high" | "medium" | "low";
  requiredApproverRoles: string[];
  nextSteps: string[];
  deadlineDefinitions: DeadlineDefinition[];
}

interface RuleOutput {
  decision?: string;
  reason_sv?: string;
  track?: string;
}

interface DeadlineParams {
  deadline_type?: string;
  hours_from_significant?: number;
  days_from_notification?: number;
}

export function runSignificanceEngine(
  rules: RegulatoryRule[],
  facts: Facts,
  scope: { sector?: string; subsector?: string; entityType?: string; classification?: string } = {},
): SignificanceResult {
  const evaluations = evaluateRules(
    rules.filter((r) => r.ruleType !== "deadline"),
    facts,
    scope,
  );

  const matchedRules: MatchedRuleSummary[] = [];
  const reasons: string[] = [];
  const missingFacts = new Set<string>();
  const legalReferences = new Set<string>();
  const approvers = new Set<string>();
  const alsoAssess = {
    gdpr: false,
    pts: false,
    eidas: false,
    contracts: false,
    insurance: false,
    stateAgency: false,
  };

  let significantMatched = false;
  let manualReviewMatched = false;
  let ruleCoveragePartial = false;
  let lowestConfidence: "high" | "medium" | "low" = "high";

  const downgrade = (c: "high" | "medium" | "low") => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    if (order[c] > order[lowestConfidence]) lowestConfidence = c;
  };

  for (const evaluation of evaluations) {
    const rule = evaluation.rule;
    const output = rule.output as RuleOutput;

    if (evaluation.outcome === "missing_facts") {
      if (rule.ruleType === "significance_threshold" || rule.ruleType === "recurring_incident") {
        for (const f of evaluation.missingFacts) missingFacts.add(f);
      }
      continue;
    }
    if (evaluation.outcome !== "matched") continue;

    const summary: MatchedRuleSummary = {
      ruleSetCode: rule.ruleSetCode,
      ruleCode: rule.ruleCode,
      titleSv: rule.titleSv,
      reasonSv: output.reason_sv ?? rule.descriptionSv ?? rule.titleSv,
      legalReference: rule.legalReference,
      coverageStatus: rule.coverageStatus,
      status: rule.status,
    };

    if (rule.legalReference) legalReferences.add(rule.legalReference);
    if (rule.requiredApproverRole) approvers.add(rule.requiredApproverRole);

    const isPartial =
      rule.status === "draft" ||
      rule.status === "pending_guidance" ||
      rule.coverageStatus === "partially_supported" ||
      rule.coverageStatus === "pending_regulatory_guidance";
    if (isPartial) {
      ruleCoveragePartial = true;
      downgrade("medium");
    }
    downgrade(rule.confidence);

    switch (output.decision) {
      case "significant":
        significantMatched = true;
        matchedRules.push(summary);
        reasons.push(summary.reasonSv);
        break;
      case "manual_review":
        manualReviewMatched = true;
        matchedRules.push(summary);
        reasons.push(summary.reasonSv);
        downgrade("low");
        break;
      case "also_assess": {
        matchedRules.push(summary);
        const track = output.track;
        if (track === "gdpr") alsoAssess.gdpr = true;
        if (track === "pts") alsoAssess.pts = true;
        if (track === "eidas") alsoAssess.eidas = true;
        if (track === "contracts") alsoAssess.contracts = true;
        if (track === "insurance") alsoAssess.insurance = true;
        if (track === "state_agency") alsoAssess.stateAgency = true;
        break;
      }
      default:
        break;
    }
  }

  // Recommendation ladder — never guesses:
  // significant match wins; explicit manual-review matches force review;
  // undecidable rules (missing facts) => potentially significant.
  let recommendation: SignificanceRecommendation;
  if (significantMatched) {
    recommendation = ruleCoveragePartial ? "manual_review_required" : "significant_reportable";
  } else if (manualReviewMatched) {
    recommendation = "manual_review_required";
  } else if (missingFacts.size > 0) {
    recommendation = "potentially_significant";
    downgrade("medium");
  } else if (facts["severity"] === "high" || facts["severity"] === "critical") {
    recommendation = "monitor";
  } else {
    recommendation = "not_reportable";
  }

  // Deadlines come from deadline rules of matched tracks.
  const deadlineDefinitions: DeadlineDefinition[] = [];
  if (recommendation === "significant_reportable" || recommendation === "manual_review_required" || recommendation === "potentially_significant") {
    for (const rule of rules) {
      if (rule.ruleType !== "deadline") continue;
      // eIDAS deadlines only when the eIDAS track applies; state agency
      // deadlines only for state agencies.
      if (rule.ruleSetCode === "EIDAS_TRUST_SERVICE" && !alsoAssess.eidas) continue;
      if (rule.ruleSetCode === "MCFFS_2026_7" && !alsoAssess.stateAgency) continue;
      const params = rule.params as DeadlineParams;
      if (!params.deadline_type) continue;
      deadlineDefinitions.push({
        deadlineType: params.deadline_type,
        hoursFromSignificant: params.hours_from_significant,
        daysFromNotification: params.days_from_notification,
        legalReference: rule.legalReference,
        titleSv: rule.titleSv,
      });
    }
  }

  // Approvals: significance decisions always need CISO + legal review.
  approvers.add("ciso");
  if (recommendation !== "not_reportable") approvers.add("legal_compliance");

  const nextSteps = buildNextSteps(recommendation, alsoAssess, missingFacts.size > 0);

  return {
    recommendation,
    ruleCoveragePartial,
    alsoAssess,
    matchedRules,
    reasons,
    missingFacts: [...missingFacts],
    legalReferences: [...legalReferences],
    confidence: lowestConfidence,
    requiredApproverRoles: [...approvers],
    nextSteps,
    deadlineDefinitions,
  };
}

function buildNextSteps(
  recommendation: SignificanceRecommendation,
  alsoAssess: SignificanceResult["alsoAssess"],
  hasMissingFacts: boolean,
): string[] {
  const steps: string[] = [];
  if (recommendation === "significant_reportable") {
    steps.push("CISO granskar bedömningen.");
    steps.push("Juridik godkänner rapporteringsbeslutet.");
    steps.push("Skapa 24h-upplysning i rapportmodulen och skicka via Cyberportalen.");
  } else if (recommendation === "manual_review_required") {
    steps.push("CISO och juridik gör manuell bedömning mot regelkällorna.");
    steps.push("Dokumentera beslutet med motivering i beslutsloggen.");
  } else if (recommendation === "potentially_significant") {
    if (hasMissingFacts) steps.push("Komplettera saknade uppgifter och kör bedömningen igen.");
    steps.push("Bevaka incidenten och uppdatera tidslinjen löpande.");
    steps.push("Förbered utkast till 24h-upplysning om läget förvärras.");
  } else if (recommendation === "monitor") {
    steps.push("Bevaka incidenten och kör om bedömningen vid förändring.");
  } else {
    steps.push("Dokumentera bedömningen och stäng rapporteringsfrågan.");
  }
  if (alsoAssess.gdpr) steps.push("Starta GDPR/IMY-bedömningen (normalt inom 72 timmar).");
  if (alsoAssess.stateAgency) steps.push("Hantera statligt rapporteringsspår (MCFFS 2026:7, 6h-varning där tillämpligt).");
  if (alsoAssess.eidas) steps.push("Kontrollera eIDAS/PTS-spåret för betrodda tjänster.");
  if (alsoAssess.pts) steps.push("Gör manuell bedömning mot PTS sektorsregler (ej slutliga).");
  if (alsoAssess.contracts) steps.push("Kontrollera avtalade rapporteringsfrister mot kunder/leverantörer.");
  if (alsoAssess.insurance) steps.push("Notifiera cyberförsäkringen enligt villkoren.");
  return steps;
}
