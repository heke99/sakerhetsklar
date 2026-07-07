# RLS and security model

## Principles

- RLS is enabled on **every** table.
- Frontend clients use the anon key with the user's session; direct table reads
  are limited by RLS to the user's own tenants.
- Sensitive operations (writes, cross-entity workflows, exports) go through the
  server-side API layer, which uses the service role **after** authorization
  checks in `src/lib/authz`.
- Platform administrators do **not** get blanket access to tenant business
  data. They see control-plane metadata; tenant data requires an approved
  support access request or break-glass session (both logged).

## Helper functions (schema `app`, SECURITY DEFINER)

- `app.is_platform_admin()` / `app.has_platform_role(text[])`
- `app.current_tenant_ids()` / `app.is_tenant_member(uuid)`
- `app.has_tenant_role(uuid, text[])`
- `app.has_support_access(uuid)` — true only for approved, unexpired requests
- `app.can_access_tenant(uuid)` — member OR approved support access

## Policy patterns

- Tenant data: `using (app.can_access_tenant(tenant_id))` for select; writes go
  via the service layer (no insert/update policies for authenticated users).
- Reference data (sectors, rules, lathunds): readable by any authenticated user.
- Control plane: platform-admin read; some rows (readiness, domains, backups)
  are also visible to the tenant's admins for transparency.
- Evidence: classification-scoped — restricted classifications require
  privileged tenant roles; the service layer additionally enforces ABAC and
  reason-required downloads.
- Audit logs: readable by tenant admin/CISO/auditor for their tenant and by
  platform security roles; written only via the service role.

## ABAC

`src/lib/authz/abac.ts` evaluates attribute policies (tenant, sensitivity,
classification, department, need-to-know, support-session flags, deployment
model). Deny overrides allow; default deny. Baseline policies deny restricted
evidence downloads without need-to-know and deny exports during support
sessions without explicit approval. Tenant-specific policies live in
`abac_policies`.

## Model B/C

Data-plane access for Model B/C never depends only on `tenant_id`: each tenant
has a physically separate database resolved via
`tenant_data_plane_connections`, with secrets referenced (never stored). The
same migrations and RLS policies apply inside each data plane.

## Verification

`scripts/db-test.sh` provisions a scratch Postgres with a Supabase shim and
runs SQL assertions: cross-tenant isolation, anonymous access refusal,
write-leak refusal, support-access gating (before/after approval/expiry). Run
locally or in CI; also apply to real environments via `supabase db`.
