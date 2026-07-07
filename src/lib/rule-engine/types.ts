/** JSON condition DSL for regulatory rules. Stored in the database — never hardcoded. */

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "exists"
  | "is_true"
  | "is_false";

export interface FactCondition {
  fact: string;
  op: ConditionOperator;
  value?: unknown;
}

export interface AllCondition {
  all: RuleCondition[];
}

export interface AnyCondition {
  any: RuleCondition[];
}

export interface NotCondition {
  not: RuleCondition;
}

export type RuleCondition = FactCondition | AllCondition | AnyCondition | NotCondition;

export type Facts = Record<string, unknown>;

export type RuleStatus =
  | "active"
  | "draft"
  | "pending_guidance"
  | "replaced"
  | "repealed"
  | "archived";

export type CoverageStatus =
  | "fully_supported"
  | "partially_supported"
  | "unsupported"
  | "requires_manual_review"
  | "pending_regulatory_guidance";

export type Confidence = "high" | "medium" | "low";

export interface RegulatoryRule {
  id: string;
  ruleSetCode: string;
  ruleCode: string;
  titleSv: string;
  descriptionSv?: string | null;
  ruleType:
    | "coverage"
    | "classification"
    | "significance_threshold"
    | "deadline"
    | "reporting_requirement"
    | "control_requirement"
    | "flag"
    | "recurring_incident";
  applicableSectors: string[];
  applicableSubsectors: string[];
  applicableEntityTypes: string[];
  applicableClassifications: string[];
  condition: RuleCondition | null;
  params: Record<string, unknown>;
  output: Record<string, unknown>;
  legalReference: string | null;
  status: RuleStatus;
  coverageStatus: CoverageStatus;
  confidence: Confidence;
  requiredApproverRole: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export type EvaluationOutcome = "matched" | "not_matched" | "missing_facts";

export interface RuleEvaluation {
  rule: RegulatoryRule;
  outcome: EvaluationOutcome;
  missingFacts: string[];
  /** Plain-language reasons produced from matched fact conditions. */
  matchedConditions: FactCondition[];
}
