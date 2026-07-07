import type {
  Facts,
  FactCondition,
  RegulatoryRule,
  RuleCondition,
  RuleEvaluation,
} from "./types";

type TriState = "true" | "false" | "unknown";

function isFactCondition(c: RuleCondition): c is FactCondition {
  return typeof (c as FactCondition).fact === "string";
}

function compare(cond: FactCondition, facts: Facts): TriState {
  const value = facts[cond.fact];

  if (cond.op === "exists") {
    return value !== undefined && value !== null ? "true" : "false";
  }

  if (value === undefined || value === null) return "unknown";

  switch (cond.op) {
    case "eq":
      return value === cond.value ? "true" : "false";
    case "neq":
      return value !== cond.value ? "true" : "false";
    case "gt":
      return typeof value === "number" && typeof cond.value === "number"
        ? value > cond.value
          ? "true"
          : "false"
        : "unknown";
    case "gte":
      return typeof value === "number" && typeof cond.value === "number"
        ? value >= cond.value
          ? "true"
          : "false"
        : "unknown";
    case "lt":
      return typeof value === "number" && typeof cond.value === "number"
        ? value < cond.value
          ? "true"
          : "false"
        : "unknown";
    case "lte":
      return typeof value === "number" && typeof cond.value === "number"
        ? value <= cond.value
          ? "true"
          : "false"
        : "unknown";
    case "in":
      return Array.isArray(cond.value)
        ? cond.value.includes(value)
          ? "true"
          : "false"
        : "unknown";
    case "not_in":
      return Array.isArray(cond.value)
        ? !cond.value.includes(value)
          ? "true"
          : "false"
        : "unknown";
    case "contains":
      if (Array.isArray(value)) return value.includes(cond.value) ? "true" : "false";
      if (typeof value === "string" && typeof cond.value === "string") {
        return value.includes(cond.value) ? "true" : "false";
      }
      return "unknown";
    case "is_true":
      return value === true ? "true" : value === false ? "false" : "unknown";
    case "is_false":
      return value === false ? "true" : value === true ? "false" : "unknown";
    default:
      return "unknown";
  }
}

function evaluateCondition(
  condition: RuleCondition,
  facts: Facts,
  collector: { missing: Set<string>; matched: FactCondition[] },
): TriState {
  if (isFactCondition(condition)) {
    const result = compare(condition, facts);
    if (result === "unknown") collector.missing.add(condition.fact);
    if (result === "true") collector.matched.push(condition);
    return result;
  }

  if ("all" in condition) {
    let sawUnknown = false;
    for (const sub of condition.all) {
      const r = evaluateCondition(sub, facts, collector);
      if (r === "false") return "false";
      if (r === "unknown") sawUnknown = true;
    }
    return sawUnknown ? "unknown" : "true";
  }

  if ("any" in condition) {
    let sawUnknown = false;
    for (const sub of condition.any) {
      const r = evaluateCondition(sub, facts, collector);
      if (r === "true") return "true";
      if (r === "unknown") sawUnknown = true;
    }
    return sawUnknown ? "unknown" : "false";
  }

  if ("not" in condition) {
    const r = evaluateCondition(condition.not, facts, collector);
    if (r === "true") return "false";
    if (r === "false") return "true";
    return "unknown";
  }

  return "unknown";
}

/** Rule applicability filter: sector / entity type / classification scoping. */
export function ruleApplies(
  rule: RegulatoryRule,
  scope: {
    sector?: string;
    subsector?: string;
    entityType?: string;
    classification?: string;
    at?: Date;
  },
): boolean {
  if (
    rule.applicableSectors.length > 0 &&
    (!scope.sector || !rule.applicableSectors.includes(scope.sector))
  ) {
    return false;
  }
  if (
    rule.applicableSubsectors.length > 0 &&
    scope.subsector !== undefined &&
    !rule.applicableSubsectors.includes(scope.subsector)
  ) {
    return false;
  }
  if (
    rule.applicableEntityTypes.length > 0 &&
    (!scope.entityType || !rule.applicableEntityTypes.includes(scope.entityType))
  ) {
    return false;
  }
  if (
    rule.applicableClassifications.length > 0 &&
    (!scope.classification ||
      !rule.applicableClassifications.includes(scope.classification))
  ) {
    return false;
  }

  const at = scope.at ?? new Date();
  if (rule.effectiveFrom && new Date(rule.effectiveFrom) > at) return false;
  if (rule.effectiveTo && new Date(rule.effectiveTo) < at) return false;

  return true;
}

/**
 * Evaluates a single rule against a fact set. Never guesses: rules whose
 * conditions cannot be decided (missing facts) return `missing_facts` instead
 * of a false negative/positive.
 */
export function evaluateRule(rule: RegulatoryRule, facts: Facts): RuleEvaluation {
  if (!rule.condition) {
    // Rules without conditions are informational/flag rules: they "match" by
    // applicability alone (e.g. manual-review flags for a sector).
    return { rule, outcome: "matched", missingFacts: [], matchedConditions: [] };
  }

  const collector = { missing: new Set<string>(), matched: [] as FactCondition[] };
  const result = evaluateCondition(rule.condition, facts, collector);

  if (result === "true") {
    return {
      rule,
      outcome: "matched",
      missingFacts: [],
      matchedConditions: collector.matched,
    };
  }
  if (result === "false") {
    return { rule, outcome: "not_matched", missingFacts: [], matchedConditions: [] };
  }
  return {
    rule,
    outcome: "missing_facts",
    missingFacts: [...collector.missing],
    matchedConditions: collector.matched,
  };
}

export function evaluateRules(
  rules: RegulatoryRule[],
  facts: Facts,
  scope: Parameters<typeof ruleApplies>[1] = {},
): RuleEvaluation[] {
  return rules
    .filter((rule) => ruleApplies(rule, scope))
    .map((rule) => evaluateRule(rule, facts));
}
