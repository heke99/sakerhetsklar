# Testing

## Commands

```bash
npm run typecheck   # strict TypeScript
npm run lint        # ESLint (next/core-web-vitals + TS)
npm run test        # Vitest unit + contract tests
npm run db:test     # migrations + seeds + SQL RLS/integrity tests on local Postgres
npm run build       # production build
```

CI (`.github/workflows/ci.yml`) runs all of the above plus
`npm audit --audit-level=high` and a Postgres 16 job that applies all
migrations/seeds, runs the SQL suites and re-applies migrations 0019+ to
verify idempotency.

## Unit tests (Vitest, `src/**/*.test.ts`)

- Tenant resolver: unknown domains, spoofed hosts, cross-tenant leakage,
  environment mismatch, disabled/paused tenants, inactive/missing data planes,
  Model B/C routing, no-secrets assertion.
- Rule engine: DSL operators/combinators, tri-state evaluation (missing facts
  never guessed), applicability and effectivity filtering.
- SME size engine: micro/small/medium/large boundaries, group figures,
  unknown finances.
- Scope engine: essential/important/public classification, DNS any-size rule,
  trust-service manual review, missing facts → manual review.
- Significance engine: drinking-water threshold, below-threshold, monitor,
  missing facts, GDPR track flag, PTS draft → manual review + low confidence,
  partial-coverage downgrade, EU 2024/2690 cloud rule, state-agency deadline
  gating.
- Deadline engine: 24h/72h/1-month/6h computation, final-report anchoring on
  actual submission, escalation ladder idempotency, missed detection, SLA
  definitions.
- ABAC: fail-closed default, deny-overrides-allow, restricted evidence,
  support-session export denial, disabled policies, break-glass read.
- Tenant guards: 403/404 semantics, entity/tenant mismatch, permission checks.
- Data plane: Model A passthrough, Model B/C fail-closed (no connection,
  inactive connection, missing secret), no central fallback.
- Auth policy: SSO-required blocking, tenant-admin exemption, MFA AAL gating.
- Entitlements: plan rows, fail-closed defaults, tenant overrides.
- Report transitions: approval-before-submission, submission reference or
  documented override.
- Evidence file policy: allowlist/blocklist, plan-based size limits.
- Job auth: fail-closed without secret, both header conventions.
- Rate limiter and open-redirect protection (`safeNextPath`).
- OpenAPI contract: every route documented with exactly its implemented
  methods; no phantom paths.

## Database tests (`supabase/tests/`)

`scripts/db-test.sh` creates a scratch database, applies a Supabase shim
(auth schema, `auth.uid()`, storage, roles), all migrations and seeds, then
runs SQL assertions:

- `test_tenant_isolation.sql` — members see only their tenant; anonymous sees
  nothing; direct writes are refused; platform admin sees the tenant registry.
- `test_support_access.sql` — support staff see nothing before approval,
  read access after approval, nothing after expiry.

Local Postgres 16 was used during development; the same files run against any
Postgres 15+ or via `supabase db` in CI.

## Demo flows (spec §50)

Seeded in `0012_seed_demo.sql`: municipal VA reportable outage with report
draft and deadlines; energy ransomware with war room; MSP/cloud EU 2024/2690
manual review; state-agency 6h track; GDPR breach requiring IMY; late report
with generated explanation.
