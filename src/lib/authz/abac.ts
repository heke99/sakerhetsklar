/**
 * ABAC policy evaluator (spec §6). Policies are data (abac_policies table);
 * this evaluator is pure and unit-tested. Deny overrides allow; higher
 * priority wins within the same effect.
 */

export interface AbacAttributes {
  tenantId?: string;
  legalEntityId?: string;
  sector?: string;
  incidentSensitivity?: string;
  evidenceClassification?: string;
  department?: string;
  actorDepartment?: string;
  actorRoles?: string[];
  hasSupportAccessApproval?: boolean;
  informationClassification?: string;
  needToKnow?: boolean;
  deploymentModel?: string;
  isBreakGlass?: boolean;
  [key: string]: unknown;
}

export interface AbacCondition {
  attribute: string;
  op: "eq" | "neq" | "in" | "not_in" | "is_true" | "is_false";
  value?: unknown;
}

export interface AbacPolicy {
  id: string;
  effect: "allow" | "deny";
  resourceType: string;
  action: string;
  conditions: AbacCondition[];
  priority: number;
  status: "active" | "disabled";
}

function conditionHolds(cond: AbacCondition, attrs: AbacAttributes): boolean {
  const value = attrs[cond.attribute];
  switch (cond.op) {
    case "eq":
      return value === cond.value;
    case "neq":
      return value !== cond.value;
    case "in":
      return Array.isArray(cond.value) && cond.value.includes(value);
    case "not_in":
      return Array.isArray(cond.value) && !cond.value.includes(value);
    case "is_true":
      return value === true;
    case "is_false":
      return value === false;
    default:
      return false;
  }
}

export interface AbacDecision {
  allowed: boolean;
  matchedPolicyId: string | null;
  reason: string;
}

/**
 * Evaluates access for a resource/action given attributes.
 * - Disabled policies are ignored.
 * - Policies match when resource/action match (or are '*') and ALL conditions hold.
 * - Deny always overrides allow.
 * - Default is DENY (fail closed) when no allow policy matches.
 */
export function evaluateAbac(
  policies: AbacPolicy[],
  resourceType: string,
  action: string,
  attrs: AbacAttributes,
): AbacDecision {
  const applicable = policies
    .filter((p) => p.status === "active")
    .filter(
      (p) =>
        (p.resourceType === resourceType || p.resourceType === "*") &&
        (p.action === action || p.action === "*"),
    )
    .filter((p) => p.conditions.every((c) => conditionHolds(c, attrs)))
    .sort((a, b) => b.priority - a.priority);

  const deny = applicable.find((p) => p.effect === "deny");
  if (deny) {
    return { allowed: false, matchedPolicyId: deny.id, reason: "Denied by policy" };
  }
  const allow = applicable.find((p) => p.effect === "allow");
  if (allow) {
    return { allowed: true, matchedPolicyId: allow.id, reason: "Allowed by policy" };
  }
  return { allowed: false, matchedPolicyId: null, reason: "No matching allow policy (fail closed)" };
}

/** Built-in baseline policies always applied in addition to tenant policies. */
export function baselinePolicies(): AbacPolicy[] {
  return [
    {
      id: "baseline-restricted-evidence-need-to-know",
      effect: "deny",
      resourceType: "evidence",
      action: "download",
      conditions: [
        {
          attribute: "evidenceClassification",
          op: "in",
          value: ["security_sensitive", "potentially_security_classified"],
        },
        { attribute: "needToKnow", op: "is_false" },
      ],
      priority: 1000,
      status: "active",
    },
    {
      id: "baseline-support-access-no-export",
      effect: "deny",
      resourceType: "*",
      action: "export",
      conditions: [
        { attribute: "isSupportSession", op: "is_true" },
        { attribute: "supportExportApproved", op: "is_false" },
      ],
      priority: 1000,
      status: "active",
    },
    {
      id: "baseline-member-read",
      effect: "allow",
      resourceType: "*",
      action: "read",
      conditions: [{ attribute: "isTenantMember", op: "is_true" }],
      priority: 0,
      status: "active",
    },
    {
      id: "baseline-break-glass-read",
      effect: "allow",
      resourceType: "*",
      action: "read",
      conditions: [{ attribute: "isBreakGlass", op: "is_true" }],
      priority: 10,
      status: "active",
    },
  ];
}
