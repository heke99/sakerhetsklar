import { describe, expect, it } from "vitest";

import { assessSize } from "./size-engine";

const M = 1_000_000;

describe("assessSize", () => {
  it("classifies micro", () => {
    expect(
      assessSize({ employees: 5, annualTurnoverEur: 1 * M, balanceSheetTotalEur: 1 * M })
        .sizeClass,
    ).toBe("micro");
  });

  it("micro requires < 10 employees", () => {
    expect(
      assessSize({ employees: 10, annualTurnoverEur: 1 * M, balanceSheetTotalEur: 1 * M })
        .sizeClass,
    ).toBe("small");
  });

  it("classifies small (either turnover or balance under cap)", () => {
    expect(
      assessSize({ employees: 30, annualTurnoverEur: 8 * M, balanceSheetTotalEur: 12 * M })
        .sizeClass,
    ).toBe("small");
    expect(
      assessSize({ employees: 30, annualTurnoverEur: 12 * M, balanceSheetTotalEur: 8 * M })
        .sizeClass,
    ).toBe("small");
  });

  it("classifies medium", () => {
    expect(
      assessSize({ employees: 100, annualTurnoverEur: 30 * M, balanceSheetTotalEur: 30 * M })
        .sizeClass,
    ).toBe("medium");
    // Over small caps but within medium caps.
    expect(
      assessSize({ employees: 40, annualTurnoverEur: 20 * M, balanceSheetTotalEur: 20 * M })
        .sizeClass,
    ).toBe("medium");
  });

  it("classifies large at >= 250 employees regardless of finances", () => {
    expect(
      assessSize({ employees: 250, annualTurnoverEur: 1 * M, balanceSheetTotalEur: 1 * M })
        .sizeClass,
    ).toBe("large");
  });

  it("classifies large when both financial caps exceeded", () => {
    expect(
      assessSize({ employees: 100, annualTurnoverEur: 60 * M, balanceSheetTotalEur: 50 * M })
        .sizeClass,
    ).toBe("large");
  });

  it("medium boundary: turnover exactly 50m or balance exactly 43m stays medium", () => {
    expect(
      assessSize({ employees: 249, annualTurnoverEur: 50 * M, balanceSheetTotalEur: 100 * M })
        .sizeClass,
    ).toBe("medium");
    expect(
      assessSize({ employees: 249, annualTurnoverEur: 100 * M, balanceSheetTotalEur: 43 * M })
        .sizeClass,
    ).toBe("medium");
  });

  it("uses group figures when includeGroup is set", () => {
    const result = assessSize({
      employees: 20,
      annualTurnoverEur: 5 * M,
      includeGroup: true,
      groupEmployees: 400,
      groupTurnoverEur: 200 * M,
      groupBalanceSheetTotalEur: 150 * M,
    });
    expect(result.sizeClass).toBe("large");
    expect(result.usedEmployees).toBe(400);
  });

  it("headcount decides when finances are unknown", () => {
    expect(assessSize({ employees: 5 }).sizeClass).toBe("micro");
    expect(assessSize({ employees: 100 }).sizeClass).toBe("medium");
    expect(assessSize({ employees: 300 }).sizeClass).toBe("large");
  });
});
