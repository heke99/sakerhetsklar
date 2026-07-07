# Tenant admin guide

Tenant roles (spec §8): Tenant Admin, CISO/Security Lead, Incident Manager,
System Owner, Information Owner, Vendor Manager, Legal/Compliance, DPO,
Communications Lead, Management Approver, Board Viewer, External SOC,
External Consultant, Auditor. Role labels are Swedish in the UI.

## As Tenant Admin you manage

- **Inställningar** (`/app/settings`) — organization data, users, roles,
  invitations.
- **Onboarding** (`/app/onboarding`) — the ten-step setup producing the rule
  profile.
- **Supportåtkomst** (`/app/access-review`) — approve/deny/revoke vendor
  support access; view break-glass sessions and anomalies.
- **Integrationer och webhooks** — via API (`/api/v1/integrations`,
  `/api/v1/webhooks`); secrets are provided as references, never stored raw.

## Daily operations by role

- CISO: controls/readiness (`/app/controls`), risks, significance approvals.
- Incident Manager: incidents, war room, reports, deadlines.
- Legal/Compliance: report approvals, submission marking, late explanations.
- DPO: GDPR track (`/app/privacy`, incident GDPR pages), IMY decisions.
- Management Approver/Board Viewer: `/app/management`, board reports.
- Auditor: read access + exports (`/app/export-exit`).

## Important invariants

- Every write is audit-logged.
- Assessments are decision support; approvals are explicit human actions.
- Report stages can't close without a Cyberportalen ID or an audited override.
- Restricted evidence requires extra permission and a documented reason to
  download.
