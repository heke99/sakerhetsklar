-- Batch 6: digital environment / CMDB — systems, segments, critical services,
-- information assets, flows and dependencies (spec §30).

create table if not exists public.digital_environments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger digital_environments_updated_at
  before update on public.digital_environments
  for each row execute function app.set_updated_at();

create table if not exists public.systems (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  digital_environment_id uuid references public.digital_environments(id) on delete set null,
  name text not null,
  description text,
  system_type text,
  environment text not null default 'production'
    check (environment in ('production', 'test', 'dev', 'training')),
  owner_user_id uuid,
  owner_name text,
  information_owner_user_id uuid,
  information_owner_name text,
  vendor_id uuid,
  hosting_model text check (hosting_model in (
    'on_premise', 'private_cloud', 'public_cloud', 'saas', 'hybrid', 'outsourced'
  )),
  data_residency text,
  personal_data boolean,
  protected_information boolean,
  sector_critical boolean not null default false,
  rto_hours numeric(8, 2),
  rpo_hours numeric(8, 2),
  acceptable_unavailability_hours numeric(8, 2),
  acceptable_degraded_hours numeric(8, 2),
  backup_status text check (backup_status in ('ok', 'partial', 'missing', 'unknown')),
  last_restore_test date,
  mfa_status text check (mfa_status in ('enforced', 'partial', 'missing', 'unknown')),
  logging_status text check (logging_status in ('ok', 'partial', 'missing', 'unknown')),
  monitoring_status text check (monitoring_status in ('ok', 'partial', 'missing', 'unknown')),
  patch_status text check (patch_status in ('current', 'behind', 'critical_backlog', 'unknown')),
  risk_rating text check (risk_rating in ('low', 'medium', 'high', 'critical')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists systems_tenant_idx on public.systems (tenant_id);

create trigger systems_updated_at
  before update on public.systems
  for each row execute function app.set_updated_at();

create table if not exists public.system_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  segment_kind text not null default 'it' check (segment_kind in ('it', 'ot', 'dmz', 'other')),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.it_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  segment_id uuid references public.system_segments(id) on delete cascade,
  name text not null,
  network_zone text,
  created_at timestamptz not null default now()
);

create table if not exists public.ot_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  segment_id uuid references public.system_segments(id) on delete cascade,
  name text not null,
  process_area text,
  safety_critical boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.system_segment_memberships (
  system_id uuid not null references public.systems(id) on delete cascade,
  segment_id uuid not null references public.system_segments(id) on delete cascade,
  primary key (system_id, segment_id)
);

create table if not exists public.critical_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  sector_code text,
  is_external boolean not null default true,
  service_owner_user_id uuid,
  service_owner_name text,
  affected_users_estimate integer,
  rto_hours numeric(8, 2),
  rpo_hours numeric(8, 2),
  acceptable_unavailability_hours numeric(8, 2),
  manual_workaround_available boolean,
  manual_workaround_max_hours numeric(8, 2),
  recovery_priority integer,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists critical_services_tenant_idx on public.critical_services (tenant_id);

create trigger critical_services_updated_at
  before update on public.critical_services
  for each row execute function app.set_updated_at();

create table if not exists public.critical_service_systems (
  critical_service_id uuid not null references public.critical_services(id) on delete cascade,
  system_id uuid not null references public.systems(id) on delete cascade,
  primary key (critical_service_id, system_id)
);

create table if not exists public.sector_critical_systems (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  system_id uuid not null references public.systems(id) on delete cascade,
  sector_code text not null,
  justification text,
  designated_by uuid,
  created_at timestamptz not null default now(),
  unique (system_id, sector_code)
);

create table if not exists public.information_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  owner_user_id uuid,
  owner_name text,
  classification text not null default 'internal' check (classification in (
    'open', 'internal', 'confidential', 'strictly_confidential',
    'security_sensitive', 'potentially_security_classified'
  )),
  personal_data boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger information_assets_updated_at
  before update on public.information_assets
  for each row execute function app.set_updated_at();

create table if not exists public.protected_information_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  information_asset_id uuid references public.information_assets(id) on delete set null,
  name text not null,
  owner_name text,
  classification text not null default 'confidential' check (classification in (
    'confidential', 'strictly_confidential', 'security_sensitive',
    'potentially_security_classified'
  )),
  why_protected text,
  belongs_to_other_legal_person boolean not null default false,
  at_least_500_natural_persons boolean not null default false,
  security_classified_flag boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger protected_information_assets_updated_at
  before update on public.protected_information_assets
  for each row execute function app.set_updated_at();

create table if not exists public.protected_information_systems (
  protected_information_asset_id uuid not null
    references public.protected_information_assets(id) on delete cascade,
  system_id uuid not null references public.systems(id) on delete cascade,
  primary key (protected_information_asset_id, system_id)
);

create table if not exists public.information_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  from_system_id uuid references public.systems(id) on delete cascade,
  to_system_id uuid references public.systems(id) on delete cascade,
  information_asset_id uuid references public.information_assets(id) on delete set null,
  transport text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.system_dependencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  system_id uuid not null references public.systems(id) on delete cascade,
  depends_on_system_id uuid not null references public.systems(id) on delete cascade,
  dependency_type text not null default 'runtime' check (dependency_type in (
    'runtime', 'data', 'auth', 'network', 'integration', 'other'
  )),
  criticality text check (criticality in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  unique (system_id, depends_on_system_id, dependency_type)
);

-- RLS ------------------------------------------------------------------------
alter table public.digital_environments enable row level security;
alter table public.systems enable row level security;
alter table public.system_segments enable row level security;
alter table public.it_segments enable row level security;
alter table public.ot_segments enable row level security;
alter table public.system_segment_memberships enable row level security;
alter table public.critical_services enable row level security;
alter table public.critical_service_systems enable row level security;
alter table public.sector_critical_systems enable row level security;
alter table public.information_assets enable row level security;
alter table public.protected_information_assets enable row level security;
alter table public.protected_information_systems enable row level security;
alter table public.information_flows enable row level security;
alter table public.system_dependencies enable row level security;

create policy digital_environments_select on public.digital_environments
  for select using (app.can_access_tenant(tenant_id));
create policy systems_select on public.systems
  for select using (app.can_access_tenant(tenant_id));
create policy system_segments_select on public.system_segments
  for select using (app.can_access_tenant(tenant_id));
create policy it_segments_select on public.it_segments
  for select using (app.can_access_tenant(tenant_id));
create policy ot_segments_select on public.ot_segments
  for select using (app.can_access_tenant(tenant_id));
create policy system_segment_memberships_select on public.system_segment_memberships
  for select using (
    exists (
      select 1 from public.systems s
      where s.id = system_id and app.can_access_tenant(s.tenant_id)
    )
  );
create policy critical_services_select on public.critical_services
  for select using (app.can_access_tenant(tenant_id));
create policy critical_service_systems_select on public.critical_service_systems
  for select using (
    exists (
      select 1 from public.critical_services cs
      where cs.id = critical_service_id and app.can_access_tenant(cs.tenant_id)
    )
  );
create policy sector_critical_systems_select on public.sector_critical_systems
  for select using (app.can_access_tenant(tenant_id));
create policy information_assets_select on public.information_assets
  for select using (app.can_access_tenant(tenant_id));
create policy protected_information_assets_select on public.protected_information_assets
  for select using (app.can_access_tenant(tenant_id));
create policy protected_information_systems_select on public.protected_information_systems
  for select using (
    exists (
      select 1 from public.protected_information_assets pia
      where pia.id = protected_information_asset_id and app.can_access_tenant(pia.tenant_id)
    )
  );
create policy information_flows_select on public.information_flows
  for select using (app.can_access_tenant(tenant_id));
create policy system_dependencies_select on public.system_dependencies
  for select using (app.can_access_tenant(tenant_id));
