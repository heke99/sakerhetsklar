-- Batch 2: control plane, tenant domains/environments/modules, deployment
-- models, data-plane connections.
--
-- The control plane stores only non-sensitive registry/operations metadata.
-- It must never contain incident content, evidence content, report bodies,
-- personal data breach content or secrets (secrets are stored as references
-- to the server-side secret manager / environment).

-- ---------------------------------------------------------------------------
-- Deployment model history (Model A/B/C per tenant with effective dates).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_deployment_models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  deployment_model text not null check (deployment_model in (
    'multi_tenant',        -- Model A
    'single_tenant',       -- Model B
    'customer_owned'       -- Model C
  )),
  variant text check (variant in ('b_vendor_hosted', 'c1_managed_supabase', 'c2_self_hosted_supabase', 'c3_postgres')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists tenant_deployment_models_tenant_idx
  on public.tenant_deployment_models (tenant_id, effective_from desc);

-- ---------------------------------------------------------------------------
-- Control-plane tenant registry (1:1 with tenants; operational metadata only).
-- ---------------------------------------------------------------------------
create table if not exists public.control_plane_tenants (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  environment text not null default 'prod' check (environment in ('test', 'stage', 'prod')),
  product_version text,
  rule_package_version text,
  migration_status text not null default 'unknown'
    check (migration_status in ('unknown', 'pending', 'in_progress', 'up_to_date', 'failed')),
  health_status text not null default 'unknown'
    check (health_status in ('unknown', 'healthy', 'degraded', 'unhealthy')),
  production_readiness text not null default 'not_started'
    check (production_readiness in ('not_started', 'in_progress', 'blocked', 'ready')),
  backup_status text not null default 'unknown'
    check (backup_status in ('unknown', 'ok', 'stale', 'failed', 'customer_owned')),
  open_incident_count integer not null default 0,
  potential_significant_incident_count integer not null default 0,
  missed_deadline_count integer not null default 0,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger control_plane_tenants_updated_at
  before update on public.control_plane_tenants
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant domains (host → tenant routing; consumed by the tenant resolver).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null unique,
  environment text not null default 'prod' check (environment in ('test', 'stage', 'prod')),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'pending_verification', 'disabled')),
  verified_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_domains_tenant_idx on public.tenant_domains (tenant_id);

create trigger tenant_domains_updated_at
  before update on public.tenant_domains
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant environments (test/stage/prod per tenant).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_environments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  environment text not null check (environment in ('test', 'stage', 'prod')),
  status text not null default 'active' check (status in ('active', 'inactive', 'provisioning', 'decommissioned')),
  app_version text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, environment)
);

create trigger tenant_environments_updated_at
  before update on public.tenant_environments
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant modules (enabled feature modules).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_code text not null,
  enabled boolean not null default true,
  enabled_at timestamptz not null default now(),
  enabled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_code)
);

create trigger tenant_modules_updated_at
  before update on public.tenant_modules
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant auth providers (configuration metadata; secrets by reference only).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_auth_providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_type text not null check (provider_type in (
    'email_password', 'magic_link', 'entra_id_oidc', 'saml', 'oidc_generic'
  )),
  status text not null default 'active' check (status in ('active', 'inactive', 'pending_setup')),
  display_name text,
  -- Non-secret configuration (issuer URL, client id, metadata URL, domain hints).
  config jsonb not null default '{}'::jsonb,
  -- Reference to server-side secret (e.g. env var name) — never the secret itself.
  client_secret_ref text,
  mfa_required boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_auth_providers_tenant_idx
  on public.tenant_auth_providers (tenant_id);

create trigger tenant_auth_providers_updated_at
  before update on public.tenant_auth_providers
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Release / migration / readiness / health / backup status per tenant.
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_release_status (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  app_version text not null,
  rule_package_version text,
  released_at timestamptz not null default now(),
  released_by uuid,
  status text not null default 'deployed' check (status in ('scheduled', 'deploying', 'deployed', 'failed', 'rolled_back')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists tenant_release_status_tenant_idx
  on public.tenant_release_status (tenant_id, released_at desc);

create table if not exists public.tenant_migration_status (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  migration_name text not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'failed', 'skipped')),
  applied_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now(),
  unique (tenant_id, migration_name)
);

create table if not exists public.tenant_production_readiness (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  gate_code text not null,
  gate_name text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'blocked', 'passed', 'waived')),
  notes text,
  checked_at timestamptz,
  checked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, gate_code)
);

create trigger tenant_production_readiness_updated_at
  before update on public.tenant_production_readiness
  for each row execute function app.set_updated_at();

create table if not exists public.tenant_health_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  check_code text not null,
  status text not null check (status in ('healthy', 'degraded', 'unhealthy', 'unknown')),
  detail text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists tenant_health_checks_tenant_idx
  on public.tenant_health_checks (tenant_id, checked_at desc);

create table if not exists public.tenant_backup_status (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  backup_kind text not null default 'database' check (backup_kind in ('database', 'storage')),
  status text not null check (status in ('ok', 'stale', 'failed', 'customer_owned', 'unknown')),
  last_backup_at timestamptz,
  last_restore_test_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, backup_kind)
);

create trigger tenant_backup_status_updated_at
  before update on public.tenant_backup_status
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Feature flags (platform-wide + tenant overrides).
-- ---------------------------------------------------------------------------
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_code text not null unique,
  description text,
  default_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger feature_flags_updated_at
  before update on public.feature_flags
  for each row execute function app.set_updated_at();

create table if not exists public.tenant_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flag_code text not null,
  enabled boolean not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, flag_code)
);

create trigger tenant_feature_flags_updated_at
  before update on public.tenant_feature_flags
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rule package assignment per tenant.
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_rule_package_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_set_code text not null,
  version text not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  status text not null default 'active' check (status in ('active', 'superseded')),
  created_at timestamptz not null default now(),
  unique (tenant_id, rule_set_code, version)
);

create index if not exists tenant_rule_package_versions_tenant_idx
  on public.tenant_rule_package_versions (tenant_id);

-- ---------------------------------------------------------------------------
-- Support cases (metadata only, no sensitive content).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_support_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  category text not null default 'general',
  status text not null default 'open' check (status in ('open', 'waiting_customer', 'waiting_vendor', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  opened_by uuid,
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenant_support_cases_updated_at
  before update on public.tenant_support_cases
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Data-plane connections for Model B/C. Secrets stored ONLY as references
-- (environment variable / secret-manager key names) — never raw values.
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_data_plane_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  environment text not null default 'prod' check (environment in ('test', 'stage', 'prod')),
  plane_kind text not null check (plane_kind in ('supabase_managed', 'supabase_self_hosted', 'postgres')),
  supabase_url text,
  publishable_key text,           -- anon/publishable key: safe to expose to frontend
  service_role_key_ref text,      -- secret reference, resolved server-side only
  db_url_ref text,                -- secret reference, resolved server-side only
  storage_url text,
  api_base_url text,
  status text not null default 'active' check (status in ('active', 'inactive', 'provisioning', 'decommissioned')),
  owned_by text not null default 'vendor' check (owned_by in ('vendor', 'customer')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, environment)
);

create trigger tenant_data_plane_connections_updated_at
  before update on public.tenant_data_plane_connections
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Control-plane naming aliases (spec §42): read-only views over the registry.
-- ---------------------------------------------------------------------------
create or replace view public.control_plane_tenant_domains as
  select * from public.tenant_domains;
create or replace view public.control_plane_tenant_environments as
  select * from public.tenant_environments;
create or replace view public.control_plane_tenant_modules as
  select * from public.tenant_modules;
create or replace view public.control_plane_release_status as
  select * from public.tenant_release_status;
create or replace view public.control_plane_migration_status as
  select * from public.tenant_migration_status;
create or replace view public.control_plane_health_checks as
  select * from public.tenant_health_checks;
create or replace view public.control_plane_support_cases as
  select * from public.tenant_support_cases;
create or replace view public.control_plane_production_readiness as
  select * from public.tenant_production_readiness;

-- ---------------------------------------------------------------------------
-- RLS: control plane is platform-admin readable; tenant admins can read their
-- own registry rows (except data-plane connections and support metadata that
-- they need for transparency). All writes via service role.
-- ---------------------------------------------------------------------------
alter table public.tenant_deployment_models enable row level security;
alter table public.control_plane_tenants enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.tenant_environments enable row level security;
alter table public.tenant_modules enable row level security;
alter table public.tenant_auth_providers enable row level security;
alter table public.tenant_release_status enable row level security;
alter table public.tenant_migration_status enable row level security;
alter table public.tenant_production_readiness enable row level security;
alter table public.tenant_health_checks enable row level security;
alter table public.tenant_backup_status enable row level security;
alter table public.feature_flags enable row level security;
alter table public.tenant_feature_flags enable row level security;
alter table public.tenant_rule_package_versions enable row level security;
alter table public.tenant_support_cases enable row level security;
alter table public.tenant_data_plane_connections enable row level security;

create policy tenant_deployment_models_select on public.tenant_deployment_models
  for select using (app.is_platform_admin() or app.has_tenant_role(tenant_id, array['tenant_admin']));

create policy control_plane_tenants_select on public.control_plane_tenants
  for select using (app.is_platform_admin());

create policy tenant_domains_select on public.tenant_domains
  for select using (app.is_platform_admin() or app.has_tenant_role(tenant_id, array['tenant_admin']));

create policy tenant_environments_select on public.tenant_environments
  for select using (app.is_platform_admin() or app.has_tenant_role(tenant_id, array['tenant_admin']));

create policy tenant_modules_select on public.tenant_modules
  for select using (app.is_platform_admin() or app.is_tenant_member(tenant_id));

create policy tenant_auth_providers_select on public.tenant_auth_providers
  for select using (app.is_platform_admin() or app.has_tenant_role(tenant_id, array['tenant_admin']));

create policy tenant_release_status_select on public.tenant_release_status
  for select using (app.is_platform_admin());

create policy tenant_migration_status_select on public.tenant_migration_status
  for select using (app.is_platform_admin());

create policy tenant_production_readiness_select on public.tenant_production_readiness
  for select using (app.is_platform_admin() or app.has_tenant_role(tenant_id, array['tenant_admin']));

create policy tenant_health_checks_select on public.tenant_health_checks
  for select using (app.is_platform_admin());

create policy tenant_backup_status_select on public.tenant_backup_status
  for select using (app.is_platform_admin() or app.has_tenant_role(tenant_id, array['tenant_admin']));

create policy feature_flags_select on public.feature_flags
  for select using (auth.uid() is not null);

create policy tenant_feature_flags_select on public.tenant_feature_flags
  for select using (app.is_platform_admin() or app.is_tenant_member(tenant_id));

create policy tenant_rule_package_versions_select on public.tenant_rule_package_versions
  for select using (app.is_platform_admin() or app.is_tenant_member(tenant_id));

create policy tenant_support_cases_select on public.tenant_support_cases
  for select using (app.is_platform_admin() or app.has_tenant_role(tenant_id, array['tenant_admin']));

-- Data-plane connections: platform deployment roles only; publishable parts
-- are exposed to tenants through the resolver, never by direct table access.
create policy tenant_data_plane_connections_select on public.tenant_data_plane_connections
  for select using (app.has_platform_role(array['platform_owner', 'platform_admin', 'deployment_admin']));
