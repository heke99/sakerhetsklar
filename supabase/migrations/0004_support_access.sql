-- Batch 3: support access requests, approvals and audit; production readiness
-- gate seed helper.

create table if not exists public.support_access_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  scope text not null default 'read_only' check (scope in ('read_only', 'read_write')),
  include_evidence boolean not null default false,
  allow_export boolean not null default false,
  status text not null default 'requested' check (status in (
    'requested', 'approved', 'denied', 'revoked', 'expired'
  )),
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  denied_by uuid references auth.users(id),
  denied_at timestamptz,
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  expires_at timestamptz,
  auto_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_access_requests_tenant_idx
  on public.support_access_requests (tenant_id, status);
create index if not exists support_access_requests_requester_idx
  on public.support_access_requests (requested_by, status);

create trigger support_access_requests_updated_at
  before update on public.support_access_requests
  for each row execute function app.set_updated_at();

-- Every use of an active support access session is logged.
create table if not exists public.support_access_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_access_requests(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists support_access_logs_request_idx
  on public.support_access_logs (request_id);

-- Now that the table exists, give app.has_support_access its real definition.
create or replace function app.has_support_access(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_access_requests sar
    where sar.tenant_id = target_tenant
      and sar.requested_by = auth.uid()
      and sar.status = 'approved'
      and (sar.expires_at is null or sar.expires_at > now())
  );
$$;

alter table public.support_access_requests enable row level security;
alter table public.support_access_logs enable row level security;

-- Requesters see their own requests; tenant admins see requests for their
-- tenant; platform security/admin roles see all.
create policy support_access_requests_select on public.support_access_requests
  for select using (
    requested_by = auth.uid()
    or app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso'])
    or app.has_platform_role(array['platform_owner', 'platform_admin', 'support_admin', 'security_admin', 'readonly_auditor'])
  );

create policy support_access_logs_select on public.support_access_logs
  for select using (
    app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso'])
    or app.has_platform_role(array['platform_owner', 'platform_admin', 'security_admin', 'readonly_auditor'])
  );

-- Standard production readiness gates registered for every tenant.
create or replace function app.seed_production_readiness_gates(target_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_production_readiness (tenant_id, gate_code, gate_name)
  values
    (target_tenant, 'auth_configured', 'Authentication provider configured'),
    (target_tenant, 'domain_verified', 'Domain registered and verified'),
    (target_tenant, 'rls_verified', 'RLS/tenant isolation verified'),
    (target_tenant, 'backup_verified', 'Backup and restore verified'),
    (target_tenant, 'rule_profile_assigned', 'Rule profile assigned'),
    (target_tenant, 'incident_roles_assigned', 'Incident roles assigned'),
    (target_tenant, 'onboarding_complete', 'Onboarding complete')
  on conflict (tenant_id, gate_code) do nothing;
end;
$$;
