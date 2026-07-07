# Rule engine

All legal/rule logic is data. Rules are stored in `regulatory_rules`, grouped
into `regulatory_rule_sets` (CSL 2025:1506, CSF 2025:1507, MCFFS 2026:1/7/8/11/12,
PTS track, EU 2024/2690, GDPR, eIDAS, contracts, insurance, CER/DORA/security-
protection flags), versioned via `regulatory_rule_versions` and traced to
`legal_sources`.

## Rule anatomy

Each rule carries: `rule_code`, Swedish title/description, `rule_type`
(coverage, classification, significance_threshold, deadline,
reporting_requirement, control_requirement, flag, recurring_incident),
applicability (sectors, subsectors, entity types, classifications), a JSON
`condition`, `params` (e.g. deadline hours), `output` (decision payload),
`legal_reference`, `status`, `coverage_status`, `confidence`,
`required_approver_role` and effectivity dates.

## Condition DSL

```json
{ "all": [
    { "fact": "sector_critical_system_affected", "op": "is_true" },
    { "fact": "sector_critical_unavailable_hours", "op": "gt", "value": 4 }
] }
```

Operators: eq, neq, gt, gte, lt, lte, in, not_in, contains, exists, is_true,
is_false. Combinators: `all`, `any`, `not`. The evaluator
(`src/lib/rule-engine/evaluate.ts`) is tri-state: `matched`, `not_matched`, or
`missing_facts` — missing facts are reported, never guessed.

## Statuses

- Rule/rule set status: active, draft, pending_guidance, replaced, repealed,
  archived (+ manual_review_required on rule sets).
- Coverage: fully_supported, partially_supported, unsupported,
  requires_manual_review, pending_regulatory_guidance.
- Draft/pending/partial rules force `manual_review_required` outcomes and lower
  confidence in the significance engine.

## Versioning and publishing

Rule admins publish versions via `/platform/rules/[code]` (or
`POST /api/v1/rules/{code}/publish`). Publishing snapshots all rules into
`regulatory_rule_versions`, records a changelog, writes the audit trail and
lists impacted tenants (tenants with the package assigned in
`tenant_rule_package_versions`). Tenants are moved between versions explicitly.

## Consumers

- Scope engine (`src/lib/scope/engine.ts`): classification/coverage rules.
- Significance engine (`src/lib/significance/engine.ts`): threshold, recurring,
  flag and deadline rules from all assigned packages.
- Deadline engine: `deadline`-type rules provide 24h/72h/1-month/6h/eIDAS-24h
  definitions.
- Report fields: `report_field_definitions` define every Cyberportalen field
  with source rule and legal reference.
