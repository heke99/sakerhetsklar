import { describe, expect, it } from "vitest";

import { evaluateRule, evaluateRules, ruleApplies } from "./evaluate";
import type { RegulatoryRule } from "./types";

function rule(overrides: Partial<RegulatoryRule> = {}): RegulatoryRule {
  return {
    id: "r1",
    ruleSetCode: "MCFFS_2026_8",
    ruleCode: "TEST_RULE",
    titleSv: "Testregel",
    ruleType: "significance_threshold",
    applicableSectors: [],
    applicableSubsectors: [],
    applicableEntityTypes: [],
    applicableClassifications: [],
    condition: null,
    params: {},
    output: {},
    legalReference: "MCFFS 2026:8 3 kap. 2 §",
    status: "active",
    coverageStatus: "fully_supported",
    confidence: "high",
    requiredApproverRole: null,
    effectiveFrom: null,
    effectiveTo: null,
    ...overrides,
  };
}

describe("evaluateRule", () => {
  it("matches numeric thresholds (drinking water > 4h outage)", () => {
    const r = rule({
      condition: {
        all: [
          { fact: "sector_critical_system_affected", op: "is_true" },
          { fact: "unavailable_hours", op: "gt", value: 4 },
        ],
      },
    });
    expect(
      evaluateRule(r, { sector_critical_system_affected: true, unavailable_hours: 5 })
        .outcome,
    ).toBe("matched");
    expect(
      evaluateRule(r, { sector_critical_system_affected: true, unavailable_hours: 3 })
        .outcome,
    ).toBe("not_matched");
  });

  it("returns missing_facts instead of guessing", () => {
    const r = rule({
      condition: {
        all: [
          { fact: "sector_critical_system_affected", op: "is_true" },
          { fact: "unavailable_hours", op: "gt", value: 4 },
        ],
      },
    });
    const evaluation = evaluateRule(r, { sector_critical_system_affected: true });
    expect(evaluation.outcome).toBe("missing_facts");
    expect(evaluation.missingFacts).toContain("unavailable_hours");
  });

  it("short-circuits all() on a definite false even with missing facts", () => {
    const r = rule({
      condition: {
        all: [
          { fact: "a", op: "is_true" },
          { fact: "b", op: "gt", value: 4 },
        ],
      },
    });
    expect(evaluateRule(r, { a: false }).outcome).toBe("not_matched");
  });

  it("supports any() with mixed unknowns", () => {
    const r = rule({
      condition: {
        any: [
          { fact: "a", op: "is_true" },
          { fact: "b", op: "is_true" },
        ],
      },
    });
    expect(evaluateRule(r, { a: true }).outcome).toBe("matched");
    expect(evaluateRule(r, { a: false }).outcome).toBe("missing_facts");
    expect(evaluateRule(r, { a: false, b: false }).outcome).toBe("not_matched");
  });

  it("supports not()", () => {
    const r = rule({ condition: { not: { fact: "a", op: "is_true" } } });
    expect(evaluateRule(r, { a: false }).outcome).toBe("matched");
    expect(evaluateRule(r, { a: true }).outcome).toBe("not_matched");
    expect(evaluateRule(r, {}).outcome).toBe("missing_facts");
  });

  it("supports in/contains", () => {
    const r = rule({
      condition: {
        all: [
          { fact: "sector", op: "in", value: ["energy", "transport"] },
          { fact: "affected_services", op: "contains", value: "electricity" },
        ],
      },
    });
    expect(
      evaluateRule(r, { sector: "energy", affected_services: ["electricity", "heating"] })
        .outcome,
    ).toBe("matched");
    expect(
      evaluateRule(r, { sector: "banking", affected_services: ["electricity"] }).outcome,
    ).toBe("not_matched");
  });

  it("collects matched conditions for plain-language reasons", () => {
    const r = rule({
      condition: {
        all: [
          { fact: "critical_service_affected", op: "is_true" },
          { fact: "unavailable_hours", op: "gt", value: 4 },
        ],
      },
    });
    const evaluation = evaluateRule(r, {
      critical_service_affected: true,
      unavailable_hours: 6,
    });
    expect(evaluation.matchedConditions).toHaveLength(2);
    expect(evaluation.matchedConditions.map((c) => c.fact)).toContain("unavailable_hours");
  });

  it("rules without conditions match by applicability (flags)", () => {
    const r = rule({ ruleType: "flag", condition: null });
    expect(evaluateRule(r, {}).outcome).toBe("matched");
  });
});

describe("ruleApplies", () => {
  it("filters by sector", () => {
    const r = rule({ applicableSectors: ["drinking_water"] });
    expect(ruleApplies(r, { sector: "drinking_water" })).toBe(true);
    expect(ruleApplies(r, { sector: "energy" })).toBe(false);
    expect(ruleApplies(r, {})).toBe(false);
  });

  it("applies to all sectors when list is empty", () => {
    expect(ruleApplies(rule(), { sector: "energy" })).toBe(true);
    expect(ruleApplies(rule(), {})).toBe(true);
  });

  it("respects effectivity dates", () => {
    const r = rule({ effectiveFrom: "2026-07-01" });
    expect(ruleApplies(r, { at: new Date("2026-06-30") })).toBe(false);
    expect(ruleApplies(r, { at: new Date("2026-07-02") })).toBe(true);
  });

  it("filters by classification", () => {
    const r = rule({ applicableClassifications: ["essential"] });
    expect(ruleApplies(r, { classification: "essential" })).toBe(true);
    expect(ruleApplies(r, { classification: "important" })).toBe(false);
  });
});

describe("evaluateRules", () => {
  it("evaluates only applicable rules", () => {
    const rules = [
      rule({ id: "1", ruleCode: "A", applicableSectors: ["energy"] }),
      rule({ id: "2", ruleCode: "B", applicableSectors: ["drinking_water"] }),
    ];
    const results = evaluateRules(rules, {}, { sector: "energy" });
    expect(results).toHaveLength(1);
    expect(results[0].rule.ruleCode).toBe("A");
  });
});
