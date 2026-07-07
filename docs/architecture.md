# Architecture

Säkerhetsklar is a rule-driven compliance, readiness, incident and reporting
platform for the Swedish Cybersecurity Act / NIS2. It is a single Next.js App
Router application backed by Supabase/Postgres, structured so that multi-tenant
SaaS (Model A), single-tenant (Model B) and customer-owned data planes
(Model C) share the same codebase.

## Layers

1. **UI** — `/app/*` (Swedish-first tenant UI) and `/platform/*` (superadmin).
   Server components read via the service layer; client components call
   `/api/v1/*`. The frontend never talks to the database directly for
   sensitive operations and never sees service-role keys.
2. **API layer** — `src/app/api/v1/**` route handlers wrapped by
   `withApi` (`src/lib/api/handler.ts`): authentication, Zod validation,
   normalized errors. OpenAPI at `/api/v1/openapi.json`.
3. **Service layer** — `src/lib/services/**`: authorization-checked business
   operations against the data plane using the server-only admin client.
   Every important write goes through `writeAuditLog`.
4. **Domain engines** — pure, unit-tested logic:
   - `src/lib/rule-engine` — versioned rule evaluation (JSON condition DSL).
   - `src/lib/scope` — coverage/classification aggregation.
   - `src/lib/size-engine` — SME size classification.
   - `src/lib/significance` — multi-track incident significance.
   - `src/lib/deadlines` — deadline computation + escalation ladder.
   - `src/lib/authz` — RBAC context + ABAC policy evaluator.
   - `src/lib/exports` — PDF/Word/Excel/ZIP generation.
5. **Data plane** — Postgres with RLS on every table; Supabase Storage for
   evidence with signed URLs. Migrations in `supabase/migrations/`.
6. **Control plane** — non-sensitive tenant registry/operations metadata (see
   `control-plane.md`).
7. **Jobs** — secret-protected endpoints under `/api/v1/jobs/*` for deadline
   escalations, anomaly scans and webhook delivery, invoked by a scheduler.

## The product chain

Legal entity → business activity → sector/subsector → size → jurisdiction →
classification → supervisory authority → rule packages → controls → digital
environment → critical services → vendors → risks → incident → significance
assessment → reporting tracks → deadlines → Cyberportalen drafts → incident
IDs/receipts → final report → remediation → evidence → audit trail →
management dashboard → supervisory package → procurement package → exit.

Every step in the chain has a table, a service, an API endpoint and a UI.

## Principles

- Legal logic lives in the database (versioned rules), never in the frontend.
- Rules that are not final are `draft`/`pending_guidance`/`partially_supported`
  /`requires_manual_review` — the engines never guess.
- Decision support only: every assessment screen shows the responsibility
  disclaimer.
- Fail closed: unknown domains, missing permissions and undecidable rules all
  refuse rather than assume.
