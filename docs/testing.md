# Testing

## Commands

```bash
pnpm typecheck      # strict TypeScript
pnpm lint           # ESLint (next/core-web-vitals + TS)
pnpm test           # Vitest unit/integration tests
./scripts/db-test.sh  # migrations + seeds + SQL RLS tests on local Postgres
pnpm build          # production build
```

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
