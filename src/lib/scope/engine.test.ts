import { describe, expect, it } from "vitest";

import type { RegulatoryRule } from "@/lib/rule-engine/types";

import { deriveRulePackages, runScopeEngine } from "./engine";

/** Mirror of the seeded CSL classification rules (subset) for engine tests. */
function seedRules(): RegulatoryRule[] {
  const base = {
    descriptionSv: null,
    applicableSectors: [] as string[],
    applicableSubsectors: [] as string[],
    applicableEntityTypes: [] as string[],
    applicableClassifications: [] as string[],
    params: {},
    legalReference: "CSL 2025:1506",
    status: "active" as const,
    coverageStatus: "fully_supported" as const,
    confidence: "high" as const,
    requiredApproverRole: null,
    effectiveFrom: null,
    effectiveTo: null,
    ruleSetCode: "CSL_2025_1506",
  };
  return [
    {
      ...base,
      id: "1",
      ruleCode: "CSL_PUBLIC_ADMIN",
      titleSv: "Offentlig förvaltning",
      ruleType: "classification",
      condition: {
        any: [
          {
            fact: "entity_type",
            op: "in",
            value: ["municipality", "region", "state_agency", "other_public_body"],
          },
        ],
      },
      output: { decision: "classification", value: "public", priority: 90 },
    },
    {
      ...base,
      id: "2",
      ruleCode: "CSL_ANNEX1_LARGE",
      titleSv: "Bilaga 1 stor",
      ruleType: "classification",
      condition: {
        all: [
          { fact: "has_annex1_sector", op: "is_true" },
          { fact: "size_class", op: "eq", value: "large" },
        ],
      },
      output: { decision: "classification", value: "essential", priority: 80 },
    },
    {
      ...base,
      id: "3",
      ruleCode: "CSL_ANNEX1_MEDIUM",
      titleSv: "Bilaga 1 medelstor",
      ruleType: "classification",
      condition: {
        all: [
          { fact: "has_annex1_sector", op: "is_true" },
          { fact: "size_class", op: "eq", value: "medium" },
        ],
      },
      output: { decision: "classification", value: "important", priority: 70 },
    },
    {
      ...base,
      id: "4",
      ruleCode: "CSL_ANNEX2_MEDIUM_LARGE",
      titleSv: "Bilaga 2",
      ruleType: "classification",
      condition: {
        all: [
          { fact: "has_annex2_sector", op: "is_true" },
          { fact: "size_class", op: "in", value: ["medium", "large"] },
        ],
      },
      output: { decision: "classification", value: "important", priority: 60 },
    },
    {
      ...base,
      id: "5",
      ruleCode: "CSL_DNS_ANY_SIZE",
      titleSv: "DNS oavsett storlek",
      ruleType: "classification",
      condition: { all: [{ fact: "is_dns_provider", op: "is_true" }] },
      output: { decision: "classification", value: "essential", priority: 85 },
    },
    {
      ...base,
      id: "6",
      ruleCode: "CSL_TRUST_SERVICE_REVIEW",
      titleSv: "Betrodda tjänster",
      ruleType: "classification",
      coverageStatus: "requires_manual_review",
      confidence: "medium",
      condition: { all: [{ fact: "is_trust_service_provider", op: "is_true" }] },
      output: {
        decision: "manual_review",
        reason_sv: "Kvalificerad status avgör väsentlig/viktig.",
        priority: 88,
      },
    },
  ];
}

describe("runScopeEngine", () => {
  it("classifies a large annex 1 operator as essential", () => {
    const result = runScopeEngine(seedRules(), {
      entity_type: "private_company",
      size_class: "large",
      has_annex1_sector: true,
      has_annex2_sector: false,
      is_dns_provider: false,
      is_trust_service_provider: false,
    });
    expect(result.likelyCovered).toBe("yes");
    expect(result.classification).toBe("essential");
    expect(result.confidence).toBe("high");
    expect(result.matchedRules.map((r) => r.ruleCode)).toContain("CSL_ANNEX1_LARGE");
  });

  it("classifies a medium annex 1 operator as important", () => {
    const result = runScopeEngine(seedRules(), {
      entity_type: "private_company",
      size_class: "medium",
      has_annex1_sector: true,
      has_annex2_sector: false,
      is_dns_provider: false,
      is_trust_service_provider: false,
    });
    expect(result.classification).toBe("important");
  });

  it("classifies public bodies as public", () => {
    const result = runScopeEngine(seedRules(), {
      entity_type: "municipality",
      size_class: "large",
      has_annex1_sector: true,
      has_annex2_sector: false,
      is_dns_provider: false,
      is_trust_service_provider: false,
    });
    // Public admin has priority 90 > essential 80.
    expect(result.classification).toBe("public");
  });

  it("small annex 2 operator is not covered", () => {
    const result = runScopeEngine(seedRules(), {
      entity_type: "private_company",
      size_class: "small",
      has_annex1_sector: false,
      has_annex2_sector: true,
      is_dns_provider: false,
      is_trust_service_provider: false,
    });
    expect(result.likelyCovered).toBe("no");
    expect(result.classification).toBeNull();
  });

  it("DNS provider is essential regardless of size", () => {
    const result = runScopeEngine(seedRules(), {
      entity_type: "private_company",
      size_class: "micro",
      has_annex1_sector: true,
      has_annex2_sector: false,
      is_dns_provider: true,
      is_trust_service_provider: false,
    });
    expect(result.classification).toBe("essential");
  });

  it("trust service provider triggers manual review", () => {
    const result = runScopeEngine(seedRules(), {
      entity_type: "private_company",
      size_class: "small",
      has_annex1_sector: false,
      has_annex2_sector: false,
      is_dns_provider: false,
      is_trust_service_provider: true,
    });
    expect(result.likelyCovered).toBe("manual_review");
    expect(result.classification).toBe("manual_review");
    expect(result.manualReviewReasons.length).toBeGreaterThan(0);
    expect(result.confidence).toBe("low");
  });

  it("missing facts produce manual review, never a guess", () => {
    const result = runScopeEngine(seedRules(), {
      entity_type: "private_company",
      // size_class missing
      has_annex1_sector: true,
      has_annex2_sector: false,
      is_dns_provider: false,
      is_trust_service_provider: false,
    });
    expect(result.likelyCovered).toBe("manual_review");
    expect(result.missingFacts).toContain("size_class");
  });
});

describe("deriveRulePackages", () => {
  it("returns nothing for not-covered entities", () => {
    expect(deriveRulePackages({ likelyCovered: "no", sectors: [] })).toEqual({
      active: [],
      pending: [],
    });
  });

  it("assigns the core Swedish packages for covered entities", () => {
    const { active, pending } = deriveRulePackages({
      likelyCovered: "yes",
      sectors: ["drinking_water"],
    });
    expect(active).toContain("CSL_2025_1506");
    expect(active).toContain("MCFFS_2026_8");
    expect(active).toContain("GDPR_PERSONAL_DATA_BREACH");
    expect(pending).toContain("MCFFS_2026_11");
    expect(pending).toContain("MCFFS_2026_12");
    expect(active).not.toContain("MCFFS_2026_7");
  });

  it("adds the state agency track for state agencies", () => {
    const { active } = deriveRulePackages({
      likelyCovered: "yes",
      sectors: ["public_administration"],
      entityType: "state_agency",
    });
    expect(active).toContain("MCFFS_2026_7");
  });

  it("adds PTS + EU 2024/2690 for digital sectors, PTS as pending", () => {
    const { active, pending } = deriveRulePackages({
      likelyCovered: "yes",
      sectors: ["ict_b2b"],
    });
    expect(active).toContain("EU_2024_2690");
    expect(pending).toContain("PTS_RULE_TRACK");
  });

  it("adds eIDAS for trust service providers and DORA flag for banking", () => {
    const trust = deriveRulePackages({
      likelyCovered: "manual_review",
      sectors: ["digital_infrastructure"],
      isTrustServiceProvider: true,
    });
    expect(trust.active).toContain("EIDAS_TRUST_SERVICE");

    const bank = deriveRulePackages({ likelyCovered: "yes", sectors: ["banking"] });
    expect(bank.pending).toContain("DORA_FLAG");
  });
});
