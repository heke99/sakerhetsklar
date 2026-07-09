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
