import { describe, expect, it } from "vitest";

import { baselinePolicies, evaluateAbac, type AbacPolicy } from "./abac";

describe("evaluateAbac", () => {
  const policies = baselinePolicies();

  it("fails closed when no policy matches", () => {
    const decision = evaluateAbac(policies, "evidence", "delete", {});
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("fail closed");
  });

  it("allows tenant member reads via baseline", () => {
    const decision = evaluateAbac(policies, "incident", "read", {
      isTenantMember: true,
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies restricted evidence download without need-to-know (deny overrides allow)", () => {
    const decision = evaluateAbac(policies, "evidence", "download", {
      isTenantMember: true,
      evidenceClassification: "security_sensitive",
      needToKnow: false,
    });
    expect(decision.allowed).toBe(false);
  });

  it("allows restricted evidence download with need-to-know and explicit allow", () => {
    const withAllow: AbacPolicy[] = [
      ...policies,
      {
        id: "allow-download",
        effect: "allow",
        resourceType: "evidence",
        action: "download",
        conditions: [{ attribute: "needToKnow", op: "is_true" }],
        priority: 5,
        status: "active",
      },
    ];
    const decision = evaluateAbac(withAllow, "evidence", "download", {
      isTenantMember: true,
      evidenceClassification: "security_sensitive",
      needToKnow: true,
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies export during support sessions without explicit approval", () => {
    const decision = evaluateAbac(policies, "report", "export", {
      isSupportSession: true,
      supportExportApproved: false,
    });
    expect(decision.allowed).toBe(false);
  });

  it("ignores disabled policies", () => {
    const disabled: AbacPolicy[] = [
      {
        id: "disabled-allow",
        effect: "allow",
        resourceType: "evidence",
        action: "delete",
        conditions: [],
        priority: 100,
        status: "disabled",
      },
    ];
    expect(evaluateAbac(disabled, "evidence", "delete", {}).allowed).toBe(false);
  });

  it("break-glass grants read access and is auditable via matched policy", () => {
    const decision = evaluateAbac(policies, "incident", "read", {
      isBreakGlass: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.matchedPolicyId).toBe("baseline-break-glass-read");
  });

  it("tenant-scoped custom deny wins over custom allow", () => {
    const custom: AbacPolicy[] = [
      ...policies,
      {
        id: "allow-dept",
        effect: "allow",
        resourceType: "incident",
        action: "read",
        conditions: [{ attribute: "actorDepartment", op: "eq", value: "it" }],
        priority: 50,
        status: "active",
      },
      {
        id: "deny-external",
        effect: "deny",
        resourceType: "incident",
        action: "read",
        conditions: [{ attribute: "isExternal", op: "is_true" }],
        priority: 40,
        status: "active",
      },
    ];
    const decision = evaluateAbac(custom, "incident", "read", {
      actorDepartment: "it",
      isExternal: true,
    });
    expect(decision.allowed).toBe(false);
  });
});
