# Production readiness — batch reports

Working branch: `cursor/production-readiness-1651`.

## Batch 0 — Repository audit and baseline report

### Commands run (baseline)

| Command | Result |
| --- | --- |
| `npm ci` | Green (11s) |
| `npm run typecheck` | Green |
| `npm run lint` | Green |
| `npm run test` | Green — 7 files, 80 tests |
| `npm run build` | Green in this environment, **with warnings** (see below). Build fetched Google Fonts over the network via `next/font/google`; offline/production builds without network access will fail. |
| `npm audit` | 4 moderate, 0 high/critical: `postcss < 8.5.10` (transitive via `next`), `uuid < 11.1.1` (transitive via `exceljs`). No non-breaking fix available; documented in Batch 16. |

Build warnings:

1. `The "middleware" file convention is deprecated. Please use "proxy" instead.` (Next.js 16)
2. Turbopack NFT trace warning from `src/lib/exports/procurement.ts` (dynamic `fs`/`path` usage traced the whole project).

### What passes

- TypeScript strict mode, ESLint, all 80 unit tests (rule engine, scope, significance, deadlines, size engine, tenant resolver, ABAC).
- Rule engine is genuinely DB-driven with tri-state evaluation (`matched` / `not_matched` / `missing_facts`), versioning and coverage status.
- All ~130 public tables have RLS enabled. Invitation and API tokens stored hashed.
- Evidence downloads use signed URLs with access logging.
- Job endpoints fail closed when `JOB_RUNNER_SECRET` is unset.
- Resource-by-ID reads (incidents, reports, evidence) resolve the row first and check membership.

### What fails / is dangerous for production (pre-fix)

P0 (fixed in later batches):

- **Cross-tenant write IDOR**: ~15 write routes trusted body `tenantId` without validating that referenced resource IDs (incident, evidence, system, vendor, report, run, …) belong to that tenant. The service-role client bypasses RLS, so application checks were the only line of defence.
- **`PATCH /api/v1/security/break-glass` had no authorization** — any authenticated user could end any break-glass session.
- **No DB-level tenant integrity**: zero `unique (tenant_id, id)` constraints, zero composite FKs; 4 join tables without `tenant_id` (`critical_service_systems`, `system_segment_memberships`, `protected_information_systems`, `legal_hold_items`).
- **Auth flows incomplete**: no password reset, no invite-accept flow, open redirect via `next` param on login, raw invite tokens returned by API.
- **Model B/C design-only**: `getDataPlaneClient` never called; all services used the central admin client; no fail-closed behavior.
- **Support access flags not enforced**: `include_evidence`, `allow_export`, `scope` stored but ignored; `support_access_logs` never written.

P1:

- Entitlements/plans: schema + display only, no enforcement.
- No CI/CD, no cron config for jobs — escalations would never run.
- Health endpoint is liveness-only.
- No rate limiting anywhere.
- Demo seed (`0012_seed_demo.sql`) applied unconditionally by `scripts/db-test.sh`.
- Webhooks/Teams/email notifications scaffolded but not emitted from domain events.
- SSO advertised on login ("Entra ID — kommer snart") but not implemented.

P2:

- English enum values leak into Swedish tenant UI; missing `loading.tsx`/`error.tsx`; some silent client mutation failures.
- Static OpenAPI document with no contract tests.
- Hardcoded legal-adjacent copy in some UI paths (GDPR 72h prose, MCFFS effective dates).
- Conflicting lockfiles: both `package-lock.json` and `pnpm-lock.yaml`; README said pnpm.
- No `.env.example` despite README reference.

### Areas requiring changes

`src/app/layout.tsx` (fonts), `src/middleware.ts` (→ `proxy.ts`), `src/lib/authz/**` (tenant guards), most `src/app/api/v1/**` write routes, `src/lib/services/**` (data-plane, entitlements, support-access scopes), `src/app/login/**` + new `/reset-password` + `/invite/accept`, `src/app/(app)/app/settings` (user management), `src/app/(platform)/platform/**` (write surfaces), `supabase/migrations/**` (composite FKs), `supabase/seed/**` (verification metadata), CI/CD, docs.

---

## Batch 1 — Production build and package consistency

### Changes

- **Removed `next/font/google`**: `src/app/layout.tsx` no longer imports Geist fonts; `src/app/globals.css` now defines `--font-geist-sans`/`--font-geist-mono` as a robust system font stack (same variable names, so all existing Tailwind/theme references keep working). Production builds no longer require network access to Google Fonts.
- **Migrated `src/middleware.ts` → `src/proxy.ts`** using the Next.js 16 `proxy` convention (identical behavior: session refresh + fail-closed gating for `/app` and `/platform`). The deprecation warning is gone.
- **Fixed the Turbopack NFT trace warning**: `src/lib/exports/procurement.ts` now statically scopes `path.join(process.cwd(), "docs")` instead of joining arbitrary repo paths.
- **Package manager decision: npm.** The required verification commands use `npm ci`, and `package-lock.json` is current. Deleted `pnpm-lock.yaml` and `pnpm-workspace.yaml`. README updated to npm commands.

### Verification

`npm run build` green with **zero warnings**; `typecheck`, `lint`, `test` (80/80) green.

---

## Batch 2 — Environment configuration and local setup

### Changes

- **`.env.example` created** with every variable the codebase actually reads (core Supabase vars, `SUPABASE_DB_URL`, `APP_BASE_URL`, `APP_PRIMARY_HOSTS`, `JOB_RUNNER_SECRET`, `WEBHOOK_SIGNING_SECRET`), optional integrations (`RESEND_API_KEY`, `EMAIL_FROM`, `TEAMS_WEBHOOK_URL`, `SENTRY_DSN`, `SUPABASE_STORAGE_BUCKET`), a section explaining Model B/C secret refs, and reserved-but-unused vars kept commented out (Stripe, OIDC, SAML) so nobody sets dead configuration. `.gitignore` updated (`!.env.example`).
- **Startup validation**: `validateServerEnv()` in `src/lib/server/env.ts`, invoked from the new `src/instrumentation.ts`. In production a missing required var aborts startup with a clear list; in dev it logs a warning. Added `env.appBaseUrl` and `env.storageBucket` getters.
- **DB npm scripts**: `db:migrate` (`scripts/db-migrate.sh`), `db:seed` (`scripts/db-seed.sh`), `db:test` (existing `scripts/db-test.sh`). The seed script **skips the demo seed by default** — it only runs with explicit `SEED_DEMO=1` (closes a P0 from the audit: fictional demo tenants can no longer reach production databases through the standard tooling).
- **README rewritten setup section**: numbered install → env → migrate → seed → dev steps, per-variable docs, required external services, and production deployment notes.

### Verification

`typecheck`, `lint`, `build` green.

---
## Batch 4 — Authentication, login, password reset and invite flow (P0)

### Login

- **Open redirect fixed**: `safeNextPath()` (`src/lib/auth/safe-next.ts`, unit-tested) only allows same-origin relative paths; `//evil`, `https://evil` and backslash tricks fall back to `/app/overview`.
- "Glömt lösenord?" now links to a working `/reset-password`.
- The fake "Entra ID — kommer snart" button and English "Enterprise" divider removed (SSO handled fail-closed in Batch 5).

### Password reset

New `/reset-password` (`src/app/reset-password/`): request phase (Supabase `resetPasswordForEmail`, uniform "if the address exists" message — no account enumeration) and update phase (handles `code`/`token_hash` recovery params + `PASSWORD_RECOVERY` event, 12+ char requirement, Swedish copy).

### Invite flow

- New `src/lib/services/invitations.ts`: hashed tokens (SHA-256, 7-day TTL), single-live-invitation per address, verify (pending + unexpired + tenant active, auto-marks expired), accept (existing account → must be logged in as invitee; new account → created server-side with `email_confirm: true` since the link proves mailbox access), revoke, resend. All audited.
- **Raw tokens are no longer returned by production APIs.** In production, invitation creation **fails closed with 503** when no email provider is configured; the invite link is only included in dev responses. Email delivery via new `src/lib/server/email.ts` (Resend REST; no mock success).
- Public endpoints `POST /api/v1/invitations/lookup` and `/accept` (uniform 404 for invalid tokens, per-IP rate limited via new `src/lib/server/rate-limit.ts`).
- New `/invite/accept?token=` page: shows tenant/role/email, password setup for new users, login redirect for existing users, auto sign-in after account creation.

### User management UI

- **Tenant settings** (`/app/settings`): invite user with role select, pending invitations with resend/revoke (confirmation dialogs), member role change and deactivation (blocked for your own account), permission-aware (visible to tenant admins/platform admins only). Backed by new `PATCH /tenants/[id]/members` (`set_role` replaces roles, `deactivate` removes membership + revokes assignments — both audited) and `PATCH /tenants/[id]/invitations`.
- **Platform admin**: "Create tenant" form on `/platform/tenants` (name/slug/orgnr/type/plan/contact) and an Invitations section on the tenant profile with invite-first-admin, resend, revoke.

### Tests

`safe-next.test.ts` (open-redirect matrix), `rate-limit.test.ts` (limits, key independence, window reset). 102 unit tests green.

---

## Batch 3 — Tenant isolation and database integrity (P0)

### Service/API layer

New reusable guards in `src/lib/authz/tenant-guards.ts`:
`assertTenantAccess`, `assertTenantEntity`, `assertAllTenantEntities`, `resolveTenantFromEntity`, `assertIncidentTenant`, `assertReportTenant`, `assertEvidenceTenant`. Cross-tenant/missing resources consistently return **404** so probing cannot distinguish "exists in another tenant" from "does not exist".

Applied to every route the audit flagged:

- `POST/PATCH /incidents/[id]/comments|tasks|recipients|war-room` — incident ownership verified against body `tenantId`; task updates additionally scoped to the URL incident.
- `POST /incidents` — `systemIds`, `criticalServiceIds`, `vendorIds` verified via `assertAllTenantEntities` in `createIncident`.
- `POST /evidence` — `incidentId`/`controlId` verified in `uploadEvidence`; the `controls` update is tenant-scoped.
- `updateReportFields` — report ownership verified before field upserts.
- `POST /gdpr`, `POST /eidas` — incident verified; existing-row lookups now tenant-filtered.
- `PATCH /insurance`, `PATCH /contracts` — incident + optional `policyId`/`requirementId` verified; `POST /contracts` verifies `vendorId`.
- `POST /systems` (`vendorId`), `POST /risks` (`linkedSystemId`, `linkedVendorId`), `POST /critical-services` (`systemIds`).
- `POST/PATCH /lathunds` — `incidentId` and `runId` verified.
- `POST /scope/size` — `legalEntityId` verified.
- **`PATCH /security/break-glass`** — previously had **no authorization**; now only the session owner, tenant admin/CISO of the session's tenant, or platform security may end a session (404 on foreign IDs).

### Database layer (`supabase/migrations/0019_tenant_integrity.sql`)

- `unique (tenant_id, id)` added to 23 tenant-owned parent tables.
- **100 composite FKs** `(tenant_id, <parent>_id) → parent(tenant_id, id)` generated from the live schema, covering every child of incidents, incident_reports, evidence, systems, vendors, controls, critical_services, legal_entities, lathund_runs, war rooms, legal holds, risks and more. Nullable references use `on delete set null (col)` (PG 15+) so `tenant_id` is never nulled.
- `tenant_id` added (with backfill + not null + FKs + direct tenant RLS policies + index) to the four join tables that lacked it: `critical_service_systems`, `system_segment_memberships`, `protected_information_systems`, `legal_hold_items`.
- Missing FK added: `recipients.recipient_group_id → recipient_groups (tenant_id, id)`.
- Migration is idempotent (constraints added only when absent).
- App/seed inserts updated to include `tenant_id` on `critical_service_systems`.

### Tests

- `supabase/tests/test_tenant_integrity.sql` — proves cross-tenant comment/task/report-field/evidence-link/service-system-link/vendor-impact/deadline inserts **violate FKs even for the service role**, and same-tenant inserts still work. PASS.
- `src/lib/authz/tenant-guards.test.ts` — 14 unit tests for all guards (403 vs 404 semantics, mismatch handling, permission checks). Vitest now aliases `server-only` to a stub so server modules are unit-testable.

### Verification

`npm run test` 94/94 green, `db:test` (migrations + seeds + 3 SQL suites on local PG16) green, `typecheck`, `lint`, `build` green.

---

