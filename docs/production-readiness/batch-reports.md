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

## Batch 5 — Enterprise SSO, MFA and auth provider fail-closed behavior

### Changes

- **New `src/lib/services/auth-policy.ts`**: `getTenantAuthPolicy(tenantId)` reads `tenant_auth_providers` (active rows only); `checkAuthGate(tenantId)` enforces fail-closed:
  - Tenant requires SSO (active `entra_id_oidc`/`saml`/`oidc_generic` provider) → password sessions are **blocked for all users except tenant admins** (who must be able to finish configuration). SSO login is not offered by the product yet, so a required-SSO tenant locks rather than silently bypassing its own policy.
  - Tenant requires MFA → sessions below AAL2 (checked via Supabase `getAuthenticatorAssuranceLevel`) are blocked.
- Gate enforced in the tenant app layout on every page load; blocked users land on the new `/auth-blocked` page with Swedish explanations per reason.
- Login page no longer advertises SSO ("kommer snart" removed in Batch 4); the platform integrations page copy now states that Entra ID/OIDC/SAML requires per-tenant provisioning and fails closed — no "coming soon" presented as ready.

### Tests

`auth-policy.test.ts` — 8 tests: default policy, SSO detection, normal user blocked under SSO requirement, tenant admin exempted, MFA AAL1 blocked / AAL2 allowed, inactive providers cause no accidental lockout. 110 unit tests green.

---

## Batch 18 — Backup, restore, retention and data exit

### Operational hooks

- New `DELETE /api/v1/tenants/[id]`: platform owner only, requires typing the exact tenant name + a ≥10-char reason, **blocked with 409 while active legal holds exist**, soft-deletes (recoverable until manual purge per exit plan), audited as `tenant.deleted` with reason. Documented in OpenAPI + contract-tested.
- Legal-hold deletion blocking at the DB level was delivered in Batch 10 (migration 0023 triggers) — referenced here as the enforcement backbone.
- Tenant export verified: the supervisory package ZIP contains 20 structured JSON sections + an evidence manifest with SHA-256 hashes; support-access without `allow_export` is denied and logged.

### Documentation

New `docs/runbooks/data-lifecycle.md` ties the technical controls to operations: suspension, deliberate deletion flow, legal hold (API + trigger layers), retention (never deletes held evidence; audit-log retention separated), exit package contents and the **Model A/B/C responsibility matrix** (backup, retention runs, purge). Existing `backup-restore.md` (PITR, quarterly restore tests with hash verification) and `exit-plan/export-and-deletion.md` confirmed accurate; subprocessor list and DPA/PUB appendix already ship in the procurement package.

---

## Batch 17 — Observability, health checks and operational readiness

### Endpoints

- `/api/v1/health` — public liveness only: status, service, app version, time. No dependencies probed, nothing sensitive.
- New `/api/v1/health/readiness` — requires **platform admin session or the job secret** (external monitoring): DB connectivity, storage bucket access, migration marker (probes a column from the newest migration series), job secret/email/webhook-signing configuration presence, rule package verification freshness (degraded > 180 days), and per-tenant Model B/C data-plane readiness (count of unready planes — all fail closed). Overall status ok/degraded/failed with 503 on failure; contract-tested and documented in OpenAPI.

### Structured logging

New `src/lib/server/log.ts` — single-line JSON logs (`ts`, `level`, `event`, fields; never secrets/PII). Wired into the API error handler (path+method on unhandled errors) and readiness warnings. `SENTRY_DSN` remains a documented reserved variable; no mock integration was added.

### Existing observability confirmed

Audit viewer (`/platform/audit`, `/api/v1/audit`), tenant health page (`/platform/health` from `tenant_health_checks`/`tenant_backup_status`), integration status page, and per-domain access/export/download logs.

---

## Batch 16 — CI/CD, migration tests and dependency security

### CI (`.github/workflows/ci.yml`)

- **build-and-test** job: `npm ci` → typecheck → lint → unit + contract tests → production build → `npm audit --audit-level=high` (blocks on high/critical).
- **database-tests** job: Postgres 16 service container, runs `scripts/db-test.sh` (shim + all migrations + all seeds + the three SQL test suites: tenant isolation, support access, tenant integrity), then re-applies migrations 0019+ to verify idempotency (verified locally too: 0019–0023 re-apply cleanly). Migrations 0001–0018 are strictly ordered/apply-once (documented in the workflow).

### Dependency security

- Dependabot config: weekly grouped npm updates + GitHub Actions updates.
- `docs/security/dependency-audit.md`: `npm audit` = **0 high/critical**; the 2 moderate advisories (`postcss` via next, `uuid` via exceljs) documented with severity, path, impact assessment ("not exploitable in this product") and decision (accept; forced fixes are breaking downgrades). Review process defined.

---

## Batch 15 — Billing, plans and entitlements

### Entitlement engine

- Pure resolver `src/lib/entitlements/resolve.ts` (unit-tested): tenant override (`tenant_feature_flags` with `ent:` prefix — the explicit, reasoned path for complimentary/internal access) → plan row (`entitlements`) → **fail closed** (missing row = disabled/limit 0).
- Service `src/lib/services/entitlements.ts`: `getEntitlement`, `hasEntitlement`, `assertEntitlement` (403 `feature_not_in_plan` with Swedish message), `assertUserLimitNotReached` (counts active members + pending invitations against the plan's `users` limit), 30s cache invalidated on plan change.
- Seed `0014_seed_entitlement_matrix.sql`: complete matrix for starter/business/enterprise covering all gated keys (evidence bank, GDPR track, exports, advanced reporting, procurement, supplier risk, leadership, webhooks, API, SSO/SCIM, break-glass, IP allowlist, Model B/C) — required because the engine fails closed.

### Backend enforcement

War room actions, break-glass start, GDPR track writes, evidence upload, exports, procurement package, webhook registration, invitation creation (user limit), and **deployment model B/C switching** (requires `single_tenant`/`customer_owned_data_plane` entitlement in addition to the provisioned-plane check).

### UI enforcement

War-room page renders an "Ingår inte i er plan" panel instead of the module; break-glass controls hidden on access review without entitlement; plan visible in settings; plan assignment via platform UI (Batch 11) is audited and invalidates the entitlement cache.

### Tests

`resolve.test.ts` — plan rows, disabled rows, fail-closed default, override grant/revoke, key isolation. 261 tests green.

---

## Batch 14 — API, OpenAPI and integration contract

### OpenAPI

- Document extracted to `src/lib/api/openapi.ts` (route serves it unchanged) and extended with all endpoints added in batches 4–13: invitation lookup/accept (public + rate limits), member/invitation PATCH, legal entities, notifications, onboarding PUT, and the OpenAPI endpoint itself.
- `info.description` now documents: auth model, tenant scoping (404-without-existence-leak semantics), the uniform error format, pagination behavior, rate limits, file upload/download, job-endpoint security (both header conventions) and outbound webhook signing (HMAC over `timestamp.body`, retry policy).

### Contract tests

`src/lib/api/openapi.test.ts` walks `src/app/api/v1/**/route.ts`, extracts implemented HTTP methods and asserts **bidirectional** consistency: every route documented with exactly its implemented methods, and no documented path without an implementation. Route/spec drift now fails CI. (+121 assertions; 255 tests total.)

### Input validation

New `requireTenantIdParam(req)` in the API handler: `tenantId` query params are now validated as UUIDs (400 on malformed input) across 22 list routes — previously raw strings reached the query layer. Body validation was already Zod-based on all JSON routes.

---

## Batch 13 — Jobs, notifications, escalation and schedulers

### Scheduling

- `vercel.json` cron config: escalations every 15 min, webhook delivery every 5 min, anomaly scan hourly. Alternative schedulers documented (any runner that sends the secret).
- New shared `src/lib/server/job-auth.ts`: timing-safe comparison, accepts `x-job-secret` **or** `Authorization: Bearer` (Vercel Cron `CRON_SECRET` convention). Fail closed when `JOB_RUNNER_SECRET` unset. All three job routes refactored to use it.

### Notification fan-out (previously dead code)

New `src/lib/services/notify.ts`: role-resolved in-app notifications + HMAC-signed webhook enqueue + Teams (per-tenant integration) + e-mail (when Resend configured), best-effort with logging. Wired to domain events:

- `incident.created` → notify tenant_admin/ciso/incident_manager + webhook payload with incident metadata.
- `report.approved` / `report.submitted` → notify + webhook (submission reference included when present).
- Deadline escalations already create in-app notifications via the escalation job (verified; late deadlines create records + remediation tasks idempotently).

### In-app inbox

New `/app/notifications` page (severity badges, mark-all-read, per-notification open-and-mark-read) + self-scoped `GET/PATCH /api/v1/notifications` (user can only ever see/modify their own rows). Added to the tenant navigation.

### Tests

`job-auth.test.ts` — fail-closed without secret, wrong secret rejected, both header conventions accepted. 134 unit tests green.

---

## Batch 12 — Tenant UI polish and complete customer workflow

### Swedish labels

New shared label module `src/lib/labels/sv.ts` (incident status, severity, report status, significance, plan, risk, task, classification, support, exercise, deadline, onboarding) with `svLabel()` fallback. Applied to incidents list/detail, reports list, report editor status, risks, exercises, evidence classifications, settings plan (Batch 4), support-access statuses (Batch 11). "War room" renamed to **"Krisrum"** across the tenant UI.

### Landing page

Removed all "demoöversikt"/"kundvy" demo framing — CTAs now point at login or the feature section; the hero dashboard mock is explicitly labeled "Exempelvy (illustration)".

### Loading/error states

Route-level `loading.tsx` (skeletons, `aria-busy`) and `error.tsx` (Swedish/English per surface, digest reference, retry button) for both `/app` and `/platform` segments — no more blank full-page waits or unhandled render errors.

### Silent failure fixes

`control-row.tsx` now surfaces API errors with `role="alert"` instead of swallowing failed PATCHes (pattern already followed by the newer client components from Batches 4–11).

---

## Batch 11 — Platform admin / superadmin production UI

### New write surfaces (all audited server-side)

- **Tenant list** (`/platform/tenants`): "Create tenant" form (from Batch 4).
- **Tenant profile** (`/platform/tenants/[id]`), new "Management" section:
  - Plan assignment (starter/business/enterprise).
  - Status: activate / pause / suspend with confirmation dialogs.
  - Deployment model selection with explicit fail-closed messaging — Model B/C changes are rejected by the API (409) unless a provisioned active data-plane connection exists.
  - **Request support access** form: purpose (min 10 chars), scope read-only/read-write, duration ≤ 72h, include-evidence and allow-export flags. Requires tenant approval.
- **Invitations section** (from Batch 4): invite first tenant admin, resend, revoke; member count in overview.

### Tenant-side support access workflow

`/app/access-review` now has approve/deny buttons for `requested` grants and revoke (reason required) for `approved` grants, visible to tenant admin/CISO only. Status values display in Swedish. This closes the loop: platform requests → tenant approves → scoped, logged access → tenant/platform revokes.

With Batches 4/6/11 combined, a new customer can be onboarded entirely through the UI: create tenant → set plan → (optionally provision data plane, switch model) → invite first admin → admin accepts → onboarding wizard. No manual SQL/API calls required for production operations.

---

## Batch 10 — Evidence bank, file security and chain of custody

### Support-access scope enforcement (previously dead flags)

New `src/lib/authz/support-guards.ts`: for actors whose only tenant relationship is an approved support grant, `include_evidence` is now required for evidence download/upload, `scope=read_write` for uploads, and `allow_export` for exports (board report, supervisory package, Excel, procurement package, report export). Every allowed **and denied** support action is written to `support_access_logs` — the table that was never populated before.

### File security

- `src/lib/evidence/file-policy.ts` (unit-tested): extension **allowlist** (documents, logs, images, mail, archives, captures) + hard blocklist (executables/scripts), plan-based size limits (25/50/100 MB), enforced in the upload service; the old flat route-level 50 MB check removed.
- `src/lib/evidence/malware-scan.ts`: scan hook posting bytes to `MALWARE_SCAN_URL`; infected files rejected + audited; **fails closed with 503 when `MALWARE_SCAN_REQUIRED=true` and the scanner is unavailable/unset**; skipped (documented) when not configured.
- Storage was already private with 300s signed URLs and full access/custody/download logging (verified).

### Legal hold

Migration `0023_legal_hold_guard.sql`: DB triggers block both hard deletes and soft deletes (`deleted_at`) of evidence that is flagged `legal_hold` or part of an active `legal_holds` hold — no service bug, retention job or manual SQL can remove held evidence.

### UI

Evidence page now shows retention status ("Bevarande"/Tillsvidare), uploader (resolved from profiles), alongside existing hash/classification/legal-hold/custody columns, and uses the data-plane client. Improved empty state.

### Tests

`file-policy.test.ts` — allowlist, blocklist, unknown-extension rejection, plan-based limits, unknown-plan fallback. 130 unit tests green; DB suites green.

---

## Batch 9 — Incident and reporting workflow end-to-end

### Workflow controls implemented

- New pure validator `src/lib/reports/transitions.ts` (called from `setReportStatus`):
  - Submission **requires prior approval** (was previously unenforced).
  - Submission requires a **submission reference (Cyberportalen-ID)** or an explicit documented override reason; overrides are audited as `report.marked_submitted_without_reference`.
  - The stage-id step continues to require id-or-override.
- The legal deadline is marked `met` **only** as a consequence of a recorded submission (`incident_report_submissions` row) — never independently. Submission rows now carry the reference (`0022_submission_reference.sql`).
- Report editor UI updated: step 3 now collects the Cyberportalen-ID (or a ≥10-char override reason) at submission time; buttons stay disabled otherwise.
- Late reporting already requires structured reasons + `incidents.approve` permission for approval (verified); escalation job creates late-reporting records + remediation tasks idempotently (verified).
- Deadline tracks verified through existing engine tests: 24h/72h/final-report/situation-report, state-agency 6h, GDPR/IMY 72h, eIDAS/PTS, manual-review paths.

### Tests

`transitions.test.ts` — 7 tests: approval-before-submission, reference-or-override on submission and stage close, override flagging, receipt step. Combined with existing engine tests this covers: significant NIS2 incident, non-significant, GDPR path, missing facts → manual review, late reporting steps, submission-reference gating. Cross-tenant reporting blocked is covered by Batch 3 guards/FK tests. 125 unit tests green.

---

## Batch 8 — Scope assessment, onboarding and customer readiness

### Changes

- Migration `0021_onboarding_contacts.sql`: structured onboarding facts on `tenant_settings` — incident contact, reporting contact, management owner, DPO contact, SSO requirement preference, data-residency requirement, deployment model preference.
- New `PUT /api/v1/onboarding` saves the contact/requirement facts (tenant admin/CISO only, audited).
- New `GET/POST /api/v1/legal-entities` (tenant-scoped, audited) so the previously hollow legal-entities step can capture real data.
- **Onboarding wizard filled in**:
  - Legal entities step: lists existing entities + inline quick-add form (name/orgnr).
  - Incident roles step: live checklist of the six incident roles against actual `role_assignments` (green/missing indicators), plus a full contact form (incident/reporting/management/DPO) and requirement preferences (data residency, deployment model with "kräver provisionering" labels, SSO). Saving contacts is required to complete the step.
  - Systems/vendors steps: live counts from the register with warnings when empty.
  - Completion step: NIS2-readiness score and register counts before finishing.
- Onboarding page now loads via the data-plane abstraction and passes readiness (`computeReadiness`) into the wizard; dashboard already reflects `tenants.onboarding_status`, which the POST endpoint recomputes on every step change.

---

## Batch 7 — Rule engine and legal source management

### Source verification (data-driven, versioned)

- Migration `0020_rule_verification.sql`: `last_verified_at`, `verified_by`, `source_note` on `regulatory_rule_sets` + `regulatory_rules`; `last_verified_at`/`verified_by` on `legal_sources`.
- Seed `0013_seed_source_verification.sql`: official source URLs and verification stamps, **verified against official sources on 2026-07-09**: Cybersäkerhetslag (2025:1506) and Cybersäkerhetsförordning (2025:1507) via riksdagen.se (in force 2026-01-15, ordinance amended t.o.m. SFS 2026:623); MCFFS 2026:8 via mcf.se (in force 2026-07-01, reporting via cyberportalen to NCSC/CERT-SE). **Correction found during verification**: the MCFFS series is issued by Myndigheten för civilt försvar (MCF), not MSB — publisher fixed in seed. EU 2024/2690, GDPR and eIDAS linked to EUR-Lex. MCFFS 2026:11/2026:12 remain `pending` until guidance exists; PTS track remains draft/partial with mandatory manual review.

### De-hardcoded frontend legal copy

- GDPR track page: the "72 timmar" description now comes from the `regulatory_tracks` registry (GDPR_IMY row) with a cautious fallback that points to the rule profile instead of asserting a deadline.
- Controls page: the "MCFFS 2026:11 träder i kraft 1 oktober 2026" line is now rendered from `regulatory_rule_sets.effective_from`/`status` — it disappears automatically when the rule set becomes active.
- Both pages also moved their tenant queries onto the data-plane client.
- Decision documented: `deriveRulePackages` remains TS orchestration, but all package **content** (status, coverage, version, effectivity) is read from the DB when packages are assigned and displayed; the mapping itself is code-reviewed logic covered by unit tests. Engines already return `manual_review_required`/confidence and matched rules with legal references.

### Disclaimer coverage

`DecisionSupportDisclaimer` added to late-reporting, war-room, recipients, incidents list, reports list and management pages; a short disclaimer line added to the login card. All assessment-adjacent screens now carry it.

---

## Batch 6 — Model A/B/C data-plane architecture (P0)

### Abstraction

New `src/lib/server/data-plane.ts`:

- `resolveTenantDeploymentModel(tenantId)`, `getTenantControlPlaneClient()`, `getTenantDataPlaneClient(tenantId)`, `assertDataPlaneReady(tenantId)`, `filterTenantsWithUnreadyDataPlane(ids)`, `invalidateDataPlaneCache()`.
- Model A → central tenant-aware admin client. Model B/C → isolated Supabase client from `tenant_data_plane_connections` (active + `supabase_url` + secret resolvable from env ref). Anything less throws `DataPlaneNotReadyError` — **there is no fallback to the central database**.
- 30s TTL cache with explicit invalidation on deployment-model change.

### Fail-closed enforcement at the identity layer

`getActorContext` now **drops memberships and support access for any Model B/C tenant whose data plane is not ready** — every `isTenantMember`/`hasPermission` check across all routes and pages denies access until provisioning completes. This makes fail-closed behavior global rather than per-refactored-callsite.

### Service and route refactor

- Services now split control-plane (tenants registry, tenant_settings, rule packages, role assignments, notifications, reference data) from tenant-plane (incidents, reports, evidence incl. storage, scope/size assessments, deadlines, controls, readiness inputs) access: `incidents`, `reports`, `evidence`, `significance`, `deadlines`, `scope`, `readiness` all obtain the tenant client via `getTenantDataPlaneClient`.
- Tenant-guard entity checks (`assertTenantEntity` etc.) run against the claimed tenant's data plane.
- 20 tenant-data API route files refactored from `getAdminClient()` to the data-plane client. Anomaly telemetry, audit logs, support access, tenant registry and jobs intentionally stay control-plane (documented in module docstring). Escalation/anomaly jobs process the central (Model A) plane; B/C planes run their own scheduler per the deployment docs.
- `PATCH /tenants/[id]`: switching a tenant to Model B/C now returns **409 `data_plane_not_ready`** unless a fully provisioned active connection with resolvable secret exists — the platform cannot silently lock out a tenant or leave B/C "selected" while data flows centrally.

### Tests

`data-plane.test.ts` — 8 tests: Model A passthrough; B/C with no connection / inactive connection / missing secret all throw `DataPlaneNotReadyError`; **no central fallback ever occurs for B/C**; fully provisioned B returns the isolated client; unknown tenants are treated as unready (fail closed). 118 unit tests green.

---

