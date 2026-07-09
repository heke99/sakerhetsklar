/**
 * Pure validation of incident-report status transitions (batch 9 controls).
 *
 * Rules:
 * - A report cannot be marked as submitted unless it has been approved.
 * - Marking as submitted requires a submission reference (Cyberportalen id)
 *   or an explicit documented override reason.
 * - Saving the stage id requires the id or an explicit override reason.
 * - The legal deadline is only marked met as a consequence of a recorded
 *   submission (enforced in the service, which calls this validator first).
 */

export type ReportStatusTarget =
  | "ready_for_review"
  | "approved"
  | "submitted_in_cyberportalen"
  | "cyberportal_incident_id_saved"
  | "receipt_uploaded";

export interface ReportStateView {
  status: string;
  approvedAt: string | null;
}

export interface TransitionInput {
  status: ReportStatusTarget;
  cyberportalId?: string;
  overrideReason?: string;
}

export type TransitionValidation =
  | { ok: true; usedOverride: boolean }
  | { ok: false; reasonSv: string; code: string };

export function validateReportTransition(
  report: ReportStateView,
  input: TransitionInput,
): TransitionValidation {
  if (input.status === "submitted_in_cyberportalen") {
    if (!report.approvedAt && report.status !== "approved") {
      return {
        ok: false,
        code: "approval_required",
        reasonSv:
          "Rapporten måste godkännas innan den markeras som inskickad. Godkänn rapporten först.",
      };
    }
    if (!input.cyberportalId && !input.overrideReason) {
      return {
        ok: false,
        code: "submission_reference_required",
        reasonSv:
          "Inskickning kräver inlämningsreferens (Cyberportalen-ID) eller en dokumenterad motivering för undantag.",
      };
    }
    return { ok: true, usedOverride: !input.cyberportalId };
  }

  if (input.status === "cyberportal_incident_id_saved") {
    if (!input.cyberportalId && !input.overrideReason) {
      return {
        ok: false,
        code: "submission_reference_required",
        reasonSv:
          "Cyberportalen-ID krävs. Ange ID eller en uttrycklig motivering för att stänga utan ID.",
      };
    }
    return { ok: true, usedOverride: !input.cyberportalId };
  }

  return { ok: true, usedOverride: false };
}
