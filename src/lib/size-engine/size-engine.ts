/**
 * SME size engine (spec §11 step 3). Thresholds follow the EU SME definition
 * used by the Cybersecurity Act:
 *  - micro:  employees < 10  and (turnover <= 2m EUR or balance sheet <= 2m EUR)
 *  - small:  employees < 50  and (turnover <= 10m EUR or balance sheet <= 10m EUR)
 *  - medium: employees < 250 and (turnover <= 50m EUR or balance sheet <= 43m EUR), not small/micro
 *  - large:  outside SME thresholds or >= 250 employees
 */

export type SizeClass = "micro" | "small" | "medium" | "large";

export interface SizeInput {
  employees: number;
  annualTurnoverEur?: number | null;
  balanceSheetTotalEur?: number | null;
  /** Group figures used when group data should affect the assessment. */
  groupEmployees?: number | null;
  groupTurnoverEur?: number | null;
  groupBalanceSheetTotalEur?: number | null;
  includeGroup?: boolean;
}

export interface SizeResult {
  sizeClass: SizeClass;
  usedEmployees: number;
  usedTurnoverEur: number | null;
  usedBalanceSheetEur: number | null;
  includeGroup: boolean;
  explanationSv: string;
}

const M = 1_000_000;

function classify(
  employees: number,
  turnover: number | null,
  balance: number | null,
): SizeClass {
  const financialUnknown = turnover === null && balance === null;

  const underFinancial = (turnoverCap: number, balanceCap: number): boolean => {
    if (financialUnknown) return true; // headcount decides when finances unknown
    return (
      (turnover !== null && turnover <= turnoverCap) ||
      (balance !== null && balance <= balanceCap)
    );
  };

  if (employees < 10 && underFinancial(2 * M, 2 * M)) return "micro";
  if (employees < 50 && underFinancial(10 * M, 10 * M)) return "small";
  if (employees < 250 && underFinancial(50 * M, 43 * M)) return "medium";
  return "large";
}

export function assessSize(input: SizeInput): SizeResult {
  const includeGroup = Boolean(input.includeGroup);

  const employees = includeGroup
    ? Math.max(input.employees, input.groupEmployees ?? 0)
    : input.employees;
  const turnover = includeGroup
    ? (input.groupTurnoverEur ?? input.annualTurnoverEur ?? null)
    : (input.annualTurnoverEur ?? null);
  const balance = includeGroup
    ? (input.groupBalanceSheetTotalEur ?? input.balanceSheetTotalEur ?? null)
    : (input.balanceSheetTotalEur ?? null);

  const sizeClass = classify(employees, turnover, balance);

  const labels: Record<SizeClass, string> = {
    micro: "Mikroföretag",
    small: "Litet företag",
    medium: "Medelstort företag",
    large: "Stort företag",
  };

  return {
    sizeClass,
    usedEmployees: employees,
    usedTurnoverEur: turnover,
    usedBalanceSheetEur: balance,
    includeGroup,
    explanationSv: `${labels[sizeClass]}: ${employees} anställda${
      turnover !== null ? `, omsättning ${(turnover / M).toLocaleString("sv-SE")} MEUR` : ""
    }${
      balance !== null
        ? `, balansomslutning ${(balance / M).toLocaleString("sv-SE")} MEUR`
        : ""
    }${includeGroup ? " (koncernnivå)" : ""}.`,
  };
}
