import { describe, expect, it } from "vitest";

import type { RegulatoryRule } from "@/lib/rule-engine/types";

import { runSignificanceEngine } from "./engine";

function rule(overrides: Partial<RegulatoryRule>): RegulatoryRule {
  return {
    id: Math.random().toString(36).slice(2),
    ruleSetCode: "MCFFS_2026_8",
    ruleCode: "R",
    titleSv: "Regel",
    descriptionSv: null,
    ruleType: "significance_threshold",
    applicableSectors: [],
    applicableSubsectors: [],
    applicableEntityTypes: [],
    applicableClassifications: [],
    condition: null,
    params: {},
    output: {},
    legalReference: "MCFFS 2026:8",
    status: "active",
    coverageStatus: "fully_supported",
    confidence: "high",
    requiredApproverRole: null,
    effectiveFrom: null,
    effectiveTo: null,
    ...overrides,
  };
}

const drinkingWaterRule = rule({
  ruleCode: "WATER_UNAVAILABLE_4H",
  titleSv: "Dricksvatten: sektorskritiska system otillgängliga > 4h",
  applicableSectors: ["drinking_water"],
  condition: {
    all: [{ fact: "sector_critical_unavailable_hours", op: "gt", value: 4 }],
  },
  output: {
    decision: "significant",
    reason_sv: "Sektorskritiska system otillgängliga i mer än 4 timmar.",
  },
});

const gdprTrigger = rule({
  ruleSetCode: "GDPR_PERSONAL_DATA_BREACH",
  ruleCode: "GDPR_TRACK_TRIGGER",
  ruleType: "flag",
  condition: { all: [{ fact: "personal_data_possibly_affected", op: "is_true" }] },
  output: { decision: "also_assess", track: "gdpr", reason_sv: "GDPR-spår." },
  legalReference: "GDPR art. 33",
});

const deadline24h = rule({
  ruleCode: "DL_EARLY_WARNING_24H",
  titleSv: "Upplysning inom 24 timmar",
  ruleType: "deadline",
  params: { deadline_type: "early_warning", hours_from_significant: 24 },
});

const deadline72h = rule({
  ruleCode: "DL_NOTIFICATION_72H",
  titleSv: "Incidentanmälan inom 72 timmar",
  ruleType: "deadline",
  params: { deadline_type: "incident_notification", hours_from_significant: 72 },
});

const ptsDraftRule = rule({
  ruleSetCode: "PTS_RULE_TRACK",
  ruleCode: "PTS_TELECOM_DRAFT",
  titleSv: "PTS telekom (utkast)",
  applicableSectors: ["digital_infrastructure"],
  status: "draft",
  coverageStatus: "pending_regulatory_guidance",
  confidence: "low",
  condition: { all: [{ fact: "service_affected", op: "is_true" }] },
  output: { decision: "manual_review", reason_sv: "PTS-regler ej slutliga." },
});

describe("runSignificanceEngine", () => {
  it("drinking water outage > 4h is significant with 24h/72h deadlines", () => {
    const result = runSignificanceEngine(
      [drinkingWaterRule, gdprTrigger, deadline24h, deadline72h],
      { sector_critical_unavailable_hours: 6 },
      { sector: "drinking_water" },
    );
    expect(result.recommendation).toBe("significant_reportable");
    expect(result.matchedRules.map((r) => r.ruleCode)).toContain("WATER_UNAVAILABLE_4H");
    expect(result.reasons[0]).toContain("4 timmar");
    expect(result.legalReferences).toContain("MCFFS 2026:8");
    expect(result.deadlineDefinitions.map((d) => d.deadlineType)).toEqual(
      expect.arrayContaining(["early_warning", "incident_notification"]),
    );
    expect(result.requiredApproverRoles).toContain("ciso");
    expect(result.requiredApproverRoles).toContain("legal_compliance");
    expect(result.confidence).toBe("high");
  });

  it("below threshold with all facts present is not reportable", () => {
    const result = runSignificanceEngine(
      [drinkingWaterRule, gdprTrigger],
      { sector_critical_unavailable_hours: 2, severity: "low", personal_data_possibly_affected: false },
      { sector: "drinking_water" },
    );
    expect(result.recommendation).toBe("not_reportable");
  });

  it("high severity without matches becomes monitor", () => {
    const result = runSignificanceEngine(
      [drinkingWaterRule],
      { sector_critical_unavailable_hours: 2, severity: "high" },
      { sector: "drinking_water" },
    );
    expect(result.recommendation).toBe("monitor");
  });

  it("missing facts produce potentially_significant, never a guess", () => {
    const result = runSignificanceEngine(
      [drinkingWaterRule],
      {},
      { sector: "drinking_water" },
    );
    expect(result.recommendation).toBe("potentially_significant");
    expect(result.missingFacts).toContain("sector_critical_unavailable_hours");
    expect(result.nextSteps.join(" ")).toContain("Komplettera");
  });

  it("GDPR track is flagged alongside the NIS2 recommendation", () => {
    const result = runSignificanceEngine(
      [drinkingWaterRule, gdprTrigger],
      { sector_critical_unavailable_hours: 6, personal_data_possibly_affected: true },
      { sector: "drinking_water" },
    );
    expect(result.recommendation).toBe("significant_reportable");
    expect(result.alsoAssess.gdpr).toBe(true);
    expect(result.nextSteps.join(" ")).toContain("GDPR");
  });

  it("draft PTS rules force manual review and lower confidence", () => {
    const result = runSignificanceEngine(
      [ptsDraftRule],
      { service_affected: true },
      { sector: "digital_infrastructure" },
    );
    expect(result.recommendation).toBe("manual_review_required");
    expect(result.ruleCoveragePartial).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("significant match on a partial-coverage rule downgrades to manual review", () => {
    const partialSignificant = rule({
      ruleCode: "PARTIAL_SIG",
      status: "active",
      coverageStatus: "partially_supported",
      confidence: "medium",
      condition: { all: [{ fact: "x", op: "is_true" }] },
      output: { decision: "significant", reason_sv: "Delvis stödd regel." },
    });
    const result = runSignificanceEngine([partialSignificant], { x: true });
    expect(result.recommendation).toBe("manual_review_required");
    expect(result.ruleCoveragePartial).toBe(true);
  });

  it("EU 2024/2690 cloud rule: complete unavailability > 30 min is significant", () => {
    const cloudRule = rule({
      ruleSetCode: "EU_2024_2690",
      ruleCode: "ART7_CLOUD_UNAVAILABLE_30M",
      applicableSectors: ["digital_infrastructure", "ict_b2b"],
      applicableSubsectors: ["cloud"],
      legalReference: "EU 2024/2690 art. 7a",
      condition: { all: [{ fact: "complete_unavailability_minutes", op: "gt", value: 30 }] },
      output: { decision: "significant", reason_sv: "Molntjänst helt otillgänglig > 30 min." },
    });
    const result = runSignificanceEngine(
      [cloudRule],
      { complete_unavailability_minutes: 45 },
      { sector: "ict_b2b", subsector: "cloud" },
    );
    expect(result.recommendation).toBe("significant_reportable");
    expect(result.legalReferences).toContain("EU 2024/2690 art. 7a");
  });

  it("state agency deadlines only apply when the track is flagged", () => {
    const saDeadline = rule({
      ruleSetCode: "MCFFS_2026_7",
      ruleCode: "SA_DL_WARNING_6H",
      titleSv: "6h varning",
      ruleType: "deadline",
      params: { deadline_type: "state_agency_warning", hours_from_significant: 6 },
    });
    const saTrigger = rule({
      ruleSetCode: "MCFFS_2026_7",
      ruleCode: "SA_TRACK_APPLIES",
      ruleType: "flag",
      condition: { all: [{ fact: "entity_type", op: "eq", value: "state_agency" }] },
      output: { decision: "also_assess", track: "state_agency", reason_sv: "Statligt spår." },
    });

    const withoutSA = runSignificanceEngine(
      [drinkingWaterRule, saDeadline, saTrigger, deadline24h],
      { sector_critical_unavailable_hours: 6, entity_type: "private_company" },
      { sector: "drinking_water" },
    );
    expect(withoutSA.deadlineDefinitions.map((d) => d.deadlineType)).not.toContain(
      "state_agency_warning",
    );

    const withSA = runSignificanceEngine(
      [drinkingWaterRule, saDeadline, saTrigger, deadline24h],
      { sector_critical_unavailable_hours: 6, entity_type: "state_agency" },
      { sector: "drinking_water" },
    );
    expect(withSA.alsoAssess.stateAgency).toBe(true);
    expect(withSA.deadlineDefinitions.map((d) => d.deadlineType)).toContain(
      "state_agency_warning",
    );
  });
});
