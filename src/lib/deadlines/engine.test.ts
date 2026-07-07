import { describe, expect, it } from "vitest";

import {
  computeDeadlines,
  internalSlaDefinitions,
  isMissed,
  pendingEscalations,
} from "./engine";

const T0 = new Date("2026-07-01T10:00:00Z");

describe("computeDeadlines", () => {
  it("computes 24h/72h from identified_as_significant_at", () => {
    const result = computeDeadlines(
      [
        { deadlineType: "early_warning", hoursFromSignificant: 24 },
        { deadlineType: "incident_notification", hoursFromSignificant: 72 },
      ],
      { identifiedAsSignificantAt: T0 },
    );
    expect(result.find((d) => d.deadlineType === "early_warning")?.dueAt.toISOString()).toBe(
      "2026-07-02T10:00:00.000Z",
    );
    expect(
      result.find((d) => d.deadlineType === "incident_notification")?.dueAt.toISOString(),
    ).toBe("2026-07-04T10:00:00.000Z");
  });

  it("computes the final report one month after actual notification submission", () => {
    const result = computeDeadlines(
      [
        { deadlineType: "incident_notification", hoursFromSignificant: 72 },
        { deadlineType: "final_report", daysFromNotification: 30 },
      ],
      {
        identifiedAsSignificantAt: T0,
        notificationSubmittedAt: new Date("2026-07-02T08:00:00Z"),
      },
    );
    expect(result.find((d) => d.deadlineType === "final_report")?.dueAt.toISOString()).toBe(
      "2026-08-01T08:00:00.000Z",
    );
  });

  it("falls back to the notification due date when not yet submitted", () => {
    const result = computeDeadlines(
      [
        { deadlineType: "incident_notification", hoursFromSignificant: 72 },
        { deadlineType: "final_report", daysFromNotification: 30 },
      ],
      { identifiedAsSignificantAt: T0 },
    );
    // 72h after T0 = July 4, +30 days = August 3.
    expect(result.find((d) => d.deadlineType === "final_report")?.dueAt.toISOString()).toBe(
      "2026-08-03T10:00:00.000Z",
    );
  });

  it("supports the state agency 6h warning", () => {
    const result = computeDeadlines(
      [{ deadlineType: "state_agency_warning", hoursFromSignificant: 6 }],
      { identifiedAsSignificantAt: T0 },
    );
    expect(result[0].dueAt.toISOString()).toBe("2026-07-01T16:00:00.000Z");
  });
});

describe("pendingEscalations", () => {
  const due = new Date("2026-07-02T10:00:00Z");

  it("fires nothing more than 24h before the deadline", () => {
    expect(
      pendingEscalations(due, new Date("2026-07-01T09:00:00Z"), new Set()),
    ).toHaveLength(0);
  });

  it("fires T-24h at 24 hours before", () => {
    const events = pendingEscalations(due, new Date("2026-07-01T10:00:00Z"), new Set());
    expect(events.map((e) => e.key)).toEqual(["t_minus_24h"]);
  });

  it("fires all elapsed steps but skips already-fired ones", () => {
    const fired = new Set(["t_minus_24h", "t_minus_12h"]);
    const events = pendingEscalations(due, new Date("2026-07-02T08:30:00Z"), fired);
    expect(events.map((e) => e.key)).toEqual(["t_minus_6h", "t_minus_2h"]);
  });

  it("escalates to management at T-2h and marks missed at T+0", () => {
    const atT2 = pendingEscalations(due, new Date("2026-07-02T08:00:00Z"), new Set(["t_minus_24h", "t_minus_12h", "t_minus_6h"]));
    expect(atT2[0].targets).toContain("management_approver");

    const atMiss = pendingEscalations(due, new Date("2026-07-02T10:00:00Z"), new Set(["t_minus_24h", "t_minus_12h", "t_minus_6h", "t_minus_2h", "t_minus_1h"]));
    expect(atMiss.map((e) => e.key)).toEqual(["t_zero"]);
  });

  it("creates the late-reporting step at T+1h", () => {
    const events = pendingEscalations(
      due,
      new Date("2026-07-02T11:00:00Z"),
      new Set(["t_minus_24h", "t_minus_12h", "t_minus_6h", "t_minus_2h", "t_minus_1h", "t_zero"]),
    );
    expect(events.map((e) => e.key)).toEqual(["t_plus_1h"]);
  });
});

describe("isMissed", () => {
  it("is missed exactly at the due time", () => {
    expect(isMissed(T0, T0)).toBe(true);
    expect(isMissed(T0, new Date(T0.getTime() - 1000))).toBe(false);
  });
});

describe("internalSlaDefinitions", () => {
  it("maps tenant settings to SLA deadline definitions", () => {
    const defs = internalSlaDefinitions({
      sla_ciso_review_hours: 4,
      sla_legal_review_hours: 6,
      sla_management_approval_hours: 8,
      sla_customer_communication_hours: 12,
    });
    expect(defs).toHaveLength(4);
    expect(defs[0]).toMatchObject({ deadlineType: "sla_ciso_review", hoursFromSignificant: 4 });
  });
});
