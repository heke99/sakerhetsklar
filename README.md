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
npm ci
npm run dev
```

Environment variables (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (safe to expose).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable key (safe to expose).
- `SUPABASE_SERVICE_ROLE_KEY` — server-only. Never expose to the frontend.
- `SUPABASE_DB_URL` — server-only connection string used by migrations/tests.

Run database migrations with the Supabase CLI:

```bash
supabase db push        # or apply files in supabase/migrations in order
```

Seed data (no real PII) lives in `supabase/seed`.

## Scripts

- `npm run dev` — development server.
- `npm run build` — production build (no network access required; system font stack).
- `npm run lint` — lint.
- `npm run typecheck` — strict TypeScript check.
- `npm run test` — run unit tests (Vitest).
- `npm run db:test` — run database migration + RLS tests against a local Postgres (see `scripts/db-test.sh`).

## Documentation

See [docs/](docs/) — architecture, rule engine, data model, RLS/security, tenant resolver,
deployment models (multi-tenant, single-tenant, customer-owned data plane), onboarding,
incident and reporting flows, Cyberportalen copy mode, procurement/GDPR/exit packages,
accessibility, and runbooks.

Key principles:

- All legal/rule logic goes through a versioned rule engine stored in the database.
  Rules are never hardcoded in the frontend.
- Rules that are not final are marked `draft`, `pending_guidance`, `partial` or
  `manual_review_required` — never guessed.
- The Cyberportalen API is not assumed in MVP; reporting is copy/export based.
- Security-classified information must not be uploaded unless the deployment and
  handling process are approved for that information.
