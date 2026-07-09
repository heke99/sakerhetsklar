# Deployment models

Säkerhetsklar supports three deployment models from one codebase. The model is
stored on the tenant (`tenants.deployment_model`, history in
`tenant_deployment_models`) and is visible to superadmin.

## Model A — multi-tenant SaaS

- Shared application and shared database.
- Strict isolation with `tenant_id` + RLS on every table, verified by
  automated tests.
- Suitable for lower-risk private-sector tenants, demo and SMB.

## Model B — single-tenant, vendor-hosted

- One Supabase project/database per customer: own Auth, Storage, RLS, API keys,
  backups and test/stage/prod environments.
- Operated by the vendor; no sensitive tenant data in the central control
  plane.
- Suitable for municipalities, energy, VA, public sector and higher-risk
  customers. See `deployment/model-b-single-tenant.md`.

## Model C — customer-owned data plane

- The customer owns database, storage, keys/key references, audit logs,
  backups and the evidence bank.
- Variants: C1 customer-owned managed Supabase, C2 self-hosted Supabase,
  C3 plain Postgres + separate storage + vendor backend.
- The vendor provides the application/control plane, release packages, SQL
  migrations, rule templates, support and updates.
  See `deployment/model-c-customer-owned-data-plane.md`.

## How the code implements B/C (fail closed)

- `src/lib/server/data-plane.ts` is the single source of truth:
  `getTenantDataPlaneClient(tenantId)` returns the central client for Model A
  and an isolated client (from `tenant_data_plane_connections` + server-side
  secret references) for Model B/C. A B/C tenant whose plane is not fully
  provisioned (active connection, URL, resolvable secret) **throws
  `DataPlaneNotReadyError` — there is no fallback to the central database**.
- `getActorContext` drops memberships/support access for B/C tenants whose
  plane is not ready, so every authorization check across the app denies
  access until provisioning completes.
- Services (incidents, reports, evidence incl. storage, scope, deadlines,
  readiness) and tenant-data API routes obtain their client through the
  abstraction; control-plane data (tenant registry, identity, billing, rule
  reference data, audit logs, anomaly telemetry) stays central by design.
- Switching a tenant to Model B/C via `PATCH /api/v1/tenants/{id}` is rejected
  (409) unless the plane is provisioned AND the tenant has the
  `single_tenant`/`customer_owned_data_plane` entitlement.
- Migrations/seeds are plain SQL applied per data plane; release and migration
  status per tenant is tracked in the control plane. Scheduler jobs
  (escalations, webhook delivery, anomaly scan) run against the central plane;
  B/C planes run their own scheduler per this document.
- RLS policies and composite tenant FKs are identical in every data plane, so
  Model B/C isolation is defense-in-depth on top of physical separation.
