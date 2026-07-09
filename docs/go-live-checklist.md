# Go-live checklist

Run through this list before putting a new environment (or the first
production environment) live. See also `docs/runbooks/` and
`docs/production-readiness/batch-reports.md`.

## Build and quality gates

- [ ] `npm ci && npm run typecheck && npm run lint && npm run test && npm run build` green
- [ ] `npm run db:test` green against a clean Postgres
- [ ] `npm audit` — no high/critical; moderates documented in `docs/security/dependency-audit.md`
- [ ] CI pipeline green on the release commit

## Environment

- [ ] All required variables from `.env.example` set (startup fails fast otherwise)
- [ ] `JOB_RUNNER_SECRET` set and scheduler configured (`vercel.json` crons or equivalent)
- [ ] `RESEND_API_KEY`/`EMAIL_FROM` set — invitations fail closed in production without them
- [ ] `WEBHOOK_SIGNING_SECRET` set
- [ ] `MALWARE_SCAN_URL` + `MALWARE_SCAN_REQUIRED` decided (uploads fail closed when required but unavailable)
- [ ] `NEXT_PUBLIC_*` are the only variables reaching the browser

## Database

- [ ] All migrations applied (`npm run db:migrate`) — verify via `/api/v1/health/readiness`
- [ ] Seeds applied **without** demo data (`npm run db:seed`; never `SEED_DEMO=1` in production)
- [ ] Rule packages verified: `regulatory_rule_sets.last_verified_at` fresh, sources linked
- [ ] Storage bucket `evidence` exists and is private

## Functional smoke test

- [ ] `/api/v1/health` returns ok; `/api/v1/health/readiness` returns ok for a platform admin
- [ ] Login, password reset and invite-accept flows work end-to-end
- [ ] Platform admin can create tenant, set plan, invite first admin
- [ ] Tenant admin completes onboarding; scope assessment produces a rule profile
- [ ] Incident → significance → deadlines → report → approval → submission (with reference) works
- [ ] Evidence upload/download works; restricted download requires reason
- [ ] Support access request/approve/revoke round-trip works and is audited

## Security

- [ ] Cross-tenant SQL test suite green (`test_tenant_integrity.sql`, `test_tenant_isolation.sql`, `test_support_access.sql`)
- [ ] Job endpoints return 401 without the secret
- [ ] No Model B/C tenant without a ready data plane (readiness endpoint reports planes)
- [ ] SSO/MFA policy per tenant reviewed (`tenant_auth_providers`) — fail-closed gate active
- [ ] Legal disclaimer visible on login and assessment pages

## Operations

- [ ] Backup/PITR confirmed for the data plane(s); restore test scheduled (`docs/runbooks/backup-restore.md`)
- [ ] Data lifecycle runbook reviewed (`docs/runbooks/data-lifecycle.md`)
- [ ] On-call/incident response owner assigned (`docs/runbooks/platform-incident-response.md`)
