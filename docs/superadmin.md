# Superadmin guide

The platform area lives under `/platform` and requires an active platform role
(`platform_admin_users`). Platform roles: Platform Owner, Platform Admin,
Rule Admin, Support Admin, Billing Admin, Security Admin, Read-only Auditor,
Deployment Admin.

## Pages

- `/platform` — dashboard: tenant counts by status/plan/deployment model,
  onboarding funnel, missing rule profiles, incident/deadline indicators,
  support access, rule package statuses, health and readiness.
- `/platform/tenants` (+ `/[id]`) — tenant list with classification,
  deployment model, onboarding, incidents count, health, readiness, versions;
  profile with domains, readiness gates, rule packages, deployment history and
  support access. No sensitive incident content is shown.
- `/platform/rules`, `/platform/rule-versions` — rule packages with status/
  coverage, rule lists with legal references, publish flow with impacted-tenant
  preview, version history.
- `/platform/sectors`, `/platform/authorities` — reference data.
- `/platform/templates`, `/platform/lathunds` — report field templates and the
  lathund library.
- `/platform/integrations`, `/platform/billing`, `/platform/feature-flags` —
  operations.
- `/platform/support-access` — all requests; approval is always the tenant's.
- `/platform/health`, `/platform/deployments`, `/platform/release-status` —
  data-plane health, readiness gates, releases and migrations per tenant.
- `/platform/security`, `/platform/audit` — anomalies, break-glass, audit log.
- `/platform/procurement` — generated packages per tenant.

## Status colors

green = stable, yellow = missing required data, red = critical gap/missed
deadline, gray = not onboarded, blue = waiting for customer action,
purple = manual review needed.

## Key rule

Platform staff never see tenant business data without an approved support
access request (tenant-approved, time-limited, logged) or an audited
break-glass session.
