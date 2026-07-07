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

## How the code supports B/C without redesign

- The tenant resolver returns the data-plane connection per tenant; server
  code creates per-tenant clients (`getDataPlaneClient`) from secret
  references.
- Migrations/seeds are plain SQL applied per data plane; release and migration
  status per tenant is tracked in the control plane.
- RLS policies are identical in every data plane, so Model B/C isolation is
  defense-in-depth on top of physical separation.
