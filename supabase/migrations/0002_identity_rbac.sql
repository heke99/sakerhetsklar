-- Batch 1: identity, RBAC, tenant settings, invitations, notifications, storage, RLS foundation.

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh.
-- ---------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  locale text not null default 'sv',
  mfa_enrolled boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Platform admin users (control-plane operators, spec §7).
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform_role text not null check (platform_role in (
    'platform_owner', 'platform_admin', 'rule_admin', 'support_admin',
    'billing_admin', 'security_admin', 'readonly_auditor', 'deployment_admin'
  )),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform_role)
);

create trigger platform_admin_users_updated_at
  before update on public.platform_admin_users
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Roles and permissions (tenant + platform RBAC catalog).
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  scope text not null check (scope in ('platform', 'tenant')),
  name_sv text not null,
  name_en text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger roles_updated_at
  before update on public.roles
  for each row execute function app.set_updated_at();

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_id, tenant_id)
);

create index if not exists role_assignments_user_idx on public.role_assignments (user_id);
create index if not exists role_assignments_tenant_idx on public.role_assignments (tenant_id);

create trigger role_assignments_updated_at
  before update on public.role_assignments
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant membership (user belongs to tenant).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  department text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists tenant_memberships_user_idx on public.tenant_memberships (user_id);

create trigger tenant_memberships_updated_at
  before update on public.tenant_memberships
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant settings and invitations.
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  locale text not null default 'sv',
  timezone text not null default 'Europe/Stockholm',
  sla_ciso_review_hours integer not null default 4,
  sla_legal_review_hours integer not null default 6,
  sla_management_approval_hours integer not null default 8,
  sla_customer_communication_hours integer not null default 12,
  evidence_retention_days integer not null default 1825,
  require_mfa boolean not null default false,
  ip_allowlist text[],
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenant_settings_updated_at
  before update on public.tenant_settings
  for each row execute function app.set_updated_at();

create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role_code text not null,
  token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_invitations_tenant_idx on public.tenant_invitations (tenant_id);

create trigger tenant_invitations_updated_at
  before update on public.tenant_invitations
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text,
  link_path text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read_at);
create index if not exists notifications_tenant_idx on public.notifications (tenant_id);

-- ---------------------------------------------------------------------------
-- Extend tenants with fields needed from Batch 1 onwards.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists slug text unique,
  add column if not exists organization_type text,
  add column if not exists plan text not null default 'starter',
  add column if not exists primary_contact_name text,
  add column if not exists primary_contact_email text,
  add column if not exists primary_contact_phone text,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists deleted_at timestamptz;

alter table public.legal_entities
  add column if not exists is_primary boolean not null default false,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- RLS helper functions (security definer so policies can consult membership
-- tables without recursive RLS evaluation).
-- ---------------------------------------------------------------------------
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admin_users pau
    where pau.user_id = auth.uid()
      and pau.status = 'active'
  );
$$;

create or replace function app.has_platform_role(role_codes text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admin_users pau
    where pau.user_id = auth.uid()
      and pau.status = 'active'
      and pau.platform_role = any (role_codes)
  );
$$;

create or replace function app.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.tenant_id
  from public.tenant_memberships tm
  where tm.user_id = auth.uid()
    and tm.status = 'active';
$$;

create or replace function app.is_tenant_member(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = target_tenant
      and tm.status = 'active'
  );
$$;

create or replace function app.has_tenant_role(target_tenant uuid, role_codes text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_assignments ra
    join public.roles r on r.id = ra.role_id
    where ra.user_id = auth.uid()
      and ra.tenant_id = target_tenant
      and ra.status = 'active'
      and (ra.valid_to is null or ra.valid_to > now())
      and r.code = any (role_codes)
  );
$$;

-- Support access is defined in Batch 3 (support_access_requests). Declared here
-- so tenant policies can reference it from the start; redefined when the table
-- exists.
create or replace function app.has_support_access(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

create or replace function app.can_access_tenant(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app.is_tenant_member(target_tenant)
      or app.has_support_access(target_tenant);
$$;

-- ---------------------------------------------------------------------------
-- RLS policies.
-- Frontend clients authenticate as regular users; the server-side service
-- layer uses the service role (bypasses RLS) for privileged operations.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_admin_users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.role_assignments enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.notifications enable row level security;

-- profiles: user can see/update own profile; platform admins can read all.
create policy profiles_self_select on public.profiles
  for select using (user_id = auth.uid() or app.is_platform_admin());
create policy profiles_self_update on public.profiles
  for update using (user_id = auth.uid());

-- platform_admin_users: only platform admins can read; writes via service role.
create policy platform_admin_users_select on public.platform_admin_users
  for select using (app.is_platform_admin());

-- roles/permissions catalogs are readable by any authenticated user.
create policy roles_select on public.roles
  for select using (auth.uid() is not null);
create policy permissions_select on public.permissions
  for select using (auth.uid() is not null);
create policy role_permissions_select on public.role_permissions
  for select using (auth.uid() is not null);

-- role_assignments: visible to self, tenant admins of same tenant, platform admins.
create policy role_assignments_select on public.role_assignments
  for select using (
    user_id = auth.uid()
    or app.is_platform_admin()
    or (tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin']))
  );

-- tenant_memberships: visible to members of the tenant and platform admins.
create policy tenant_memberships_select on public.tenant_memberships
  for select using (
    user_id = auth.uid()
    or app.is_platform_admin()
    or app.is_tenant_member(tenant_id)
  );

-- tenants: members read their own tenants; platform admins read all.
create policy tenants_member_select on public.tenants
  for select using (app.can_access_tenant(id) or app.is_platform_admin());

-- legal_entities: tenant scoped.
create policy legal_entities_tenant_select on public.legal_entities
  for select using (app.can_access_tenant(tenant_id) or app.is_platform_admin());
create policy legal_entities_tenant_write on public.legal_entities
  for all using (app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'legal_compliance']))
  with check (app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'legal_compliance']));

-- tenant_settings: members read; tenant admin writes.
create policy tenant_settings_select on public.tenant_settings
  for select using (app.can_access_tenant(tenant_id) or app.is_platform_admin());
create policy tenant_settings_write on public.tenant_settings
  for all using (app.has_tenant_role(tenant_id, array['tenant_admin']))
  with check (app.has_tenant_role(tenant_id, array['tenant_admin']));

-- tenant_invitations: tenant admins manage; platform admins read.
create policy tenant_invitations_select on public.tenant_invitations
  for select using (
    app.has_tenant_role(tenant_id, array['tenant_admin']) or app.is_platform_admin()
  );

-- notifications: user sees own notifications.
create policy notifications_self_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_self_update on public.notifications
  for update using (user_id = auth.uid());

-- sectors and rule sets: reference data readable by authenticated users.
create policy sectors_select on public.sectors
  for select using (auth.uid() is not null);
create policy regulatory_rule_sets_select on public.regulatory_rule_sets
  for select using (auth.uid() is not null);

-- audit_logs: tenant admins/security roles read their tenant's logs; platform
-- security admins read platform logs. Writes happen only via service role.
create policy audit_logs_tenant_select on public.audit_logs
  for select using (
    (tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'auditor']))
    or app.has_platform_role(array['platform_owner', 'platform_admin', 'security_admin', 'readonly_auditor'])
  );

-- ---------------------------------------------------------------------------
-- Storage buckets for evidence and receipts (restricted; access via signed
-- URLs generated server-side).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('evidence', 'evidence', false),
  ('receipts', 'receipts', false),
  ('exports', 'exports', false)
on conflict (id) do nothing;
