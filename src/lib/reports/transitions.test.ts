import { describe, expect, it } from "vitest";

import { validateReportTransition } from "./transitions";

const draft = { status: "draft", approvedAt: null };
const approved = {
  status: "approved",
  approvedAt: "2026-07-01T10:00:00Z",
};

describe("validateReportTransition", () => {
  it("allows review/approval transitions without extra requirements", () => {
    expect(
      validateReportTransition(draft, { status: "ready_for_review" }),
    ).toEqual({ ok: true, usedOverride: false });
    expect(validateReportTransition(draft, { status: "approved" })).toEqual({
      ok: true,
      usedOverride: false,
    });
  });

  it("blocks submission before approval", () => {
    const result = validateReportTransition(draft, {
      status: "submitted_in_cyberportalen",
      cyberportalId: "CP-2026-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("approval_required");
  });

  it("blocks submission without a reference or override", () => {
    const result = validateReportTransition(approved, {
      status: "submitted_in_cyberportalen",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("submission_reference_required");
  });

  it("allows submission with a submission reference", () => {
    expect(
      validateReportTransition(approved, {
        status: "submitted_in_cyberportalen",
        cyberportalId: "CP-2026-1",
      }),
    ).toEqual({ ok: true, usedOverride: false });
  });

  it("allows submission with a documented override (flagged as override)", () => {
    expect(
      validateReportTransition(approved, {
        status: "submitted_in_cyberportalen",
        overrideReason: "Reservförfarande: Cyberportalen otillgänglig, rapport skickad per rekommenderat brev.",
      }),
    ).toEqual({ ok: true, usedOverride: true });
  });

  it("blocks closing the stage id step without id or override", () => {
    const result = validateReportTransition(approved, {
      status: "cyberportal_incident_id_saved",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("submission_reference_required");
  });

  it("allows the receipt step without extra requirements", () => {
    expect(
      validateReportTransition(approved, { status: "receipt_uploaded" }),
    ).toEqual({ ok: true, usedOverride: false });
  });
});
