# Säkerhetsklar

Säkerhetsklar is a rule-driven SaaS and enterprise/public-sector compliance platform for
Swedish organizations covered by the Swedish Cybersecurity Act (Cybersäkerhetslagen 2025:1506)
and NIS2.

Säkerhetsklar provides decision support. Final legal and regulatory responsibility remains
with the organization.

## What the platform does

- Determines whether an organization is likely covered by the Cybersecurity Act / NIS2.
- Classifies the organization as essential, important, public-sector or manual-review-required.
- Maps sectors, subsectors and supervisory authorities.
- Builds the digital environment and critical service register (CMDB).
- Manages NIS2 readiness controls, evidence and readiness scores.
- Manages suppliers and supply-chain risk.
- Manages incidents, war rooms, tasks and timelines.
- Assesses whether an incident is significant/reportable via a versioned rule engine.
- Creates reporting drafts for Cyberportalen/NCSC (copy mode, PDF/Word export).
- Tracks 24h / 72h / final-report / situation-report deadlines with escalations.
- Handles GDPR/IMY, PTS/EU, eIDAS, state-agency, contractual and insurance reporting tracks.
- Stores evidence with hashes, access logs and chain of custody.
- Prepares supervisory audit packages and procurement/security/exit packages.
- Provides a Swedish-first UI for customers and a full platform view for superadmin.

## Tech stack

- Next.js App Router, TypeScript (strict), Tailwind CSS, shadcn/ui-style components.
- Supabase/Postgres, Supabase Auth, SQL migrations, RLS.
- Server-side API layer under `/api/v1` — the frontend never performs sensitive
  operations directly against Supabase and service role keys are never exposed to the client.
- Vitest for tests.

## Getting started

The project uses **npm** with `package-lock.json` as the single source of truth.

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment
cp .env.example .env.local   # then fill in the values

# 3. Apply database migrations (requires SUPABASE_DB_URL)
npm run db:migrate

# 4. Apply seed data (reference data; demo data only with SEED_DEMO=1)
npm run db:seed

# 5. Start the dev server
npm run dev
```

Environment variables are documented in [`.env.example`](.env.example). The most important:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (safe to expose).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable key (safe to expose).
- `SUPABASE_SERVICE_ROLE_KEY` — server-only. Never expose to the frontend.
- `SUPABASE_DB_URL` — server-only connection string used by migrations/seeds/tests.
- `APP_BASE_URL` — public base URL used in invitation/password-reset links.
- `JOB_RUNNER_SECRET` — shared secret for scheduled job endpoints (jobs fail closed without it).
- `WEBHOOK_SIGNING_SECRET` — HMAC secret for outbound webhooks.
- `RESEND_API_KEY` / `EMAIL_FROM` — optional; enables transactional email.

At server startup, required variables are validated (`src/instrumentation.ts`);
a production deployment with missing configuration refuses to start with a clear
error listing the missing variables. Secrets are never bundled into client code —
only `NEXT_PUBLIC_*` variables reach the browser.

### Required external services

- **Supabase** (Postgres + Auth + Storage) — the only hard dependency.
- **Resend** (optional) — transactional email for invitations/password reset/notifications.
- **A scheduler** (Vercel Cron or equivalent) — calls `/api/v1/jobs/*` endpoints with the `x-job-secret` header. See `vercel.json`.

### Production deployment notes

- Build with `npm run build` — no network access is required at build time (system font stack, no Google Fonts).
- Run migrations against each data plane before deploying a new app version: `npm run db:migrate`.
- Never seed demo data in production: `npm run db:seed` skips `0012_seed_demo.sql` unless `SEED_DEMO=1` is set explicitly.
- Set all variables listed as required in `.env.example`; startup fails fast otherwise.

## Scripts

- `npm run dev` — development server.
- `npm run build` — production build (no network access required; system font stack).
- `npm run lint` — lint.
- `npm run typecheck` — strict TypeScript check.
- `npm run test` — run unit tests (Vitest).
- `npm run db:migrate` — apply all SQL migrations to `SUPABASE_DB_URL`.
- `npm run db:seed` — apply seed data to `SUPABASE_DB_URL` (demo seed skipped unless `SEED_DEMO=1`).
- `npm run db:test` — recreate a scratch database, apply migrations + seeds and run the SQL RLS test suite (see `scripts/db-test.sh`).

## Documentation

See [docs/](docs/) — architecture, rule engine, data model, RLS/security, tenant resolver,
deployment models (multi-tenant, single-tenant, customer-owned data plane), onboarding,
incident and reporting flows, Cyberportalen copy mode, procurement/GDPR/exit packages,
accessibility, and runbooks. Highlights:

- [docs/go-live-checklist.md](docs/go-live-checklist.md) — production readiness gate.
- [docs/security/security-overview.md](docs/security/security-overview.md) — customer-facing security summary.
- [docs/security/dependency-audit.md](docs/security/dependency-audit.md) — audit findings and decisions.
- [docs/runbooks/data-lifecycle.md](docs/runbooks/data-lifecycle.md) — retention, deletion, legal hold, exit.
- [docs/production-readiness/batch-reports.md](docs/production-readiness/batch-reports.md) — batch-by-batch hardening log.

Key principles:

- All legal/rule logic goes through a versioned rule engine stored in the database.
  Rules are never hardcoded in the frontend.
- Rules that are not final are marked `draft`, `pending_guidance`, `partial` or
  `manual_review_required` — never guessed.
- The Cyberportalen API is not assumed in MVP; reporting is copy/export based.
- Security-classified information must not be uploaded unless the deployment and
  handling process are approved for that information.
