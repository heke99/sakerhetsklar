-- Batch 7: vendors / supply chain (spec §31).

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  organization_number text,
  contact_person text,
  contact_email text,
  contact_phone text,
  incident_contact_name text,
  incident_contact_email text,
  incident_contact_phone text,
  has_24_7_contact boolean not null default false,
  services_description text,
  sla_summary text,
  data_residency text,
  personal_data_processor boolean,
  dpa_exists boolean,
  certifications text[],
  incident_reporting_hours numeric(8, 2),
  right_to_audit boolean,
  exit_plan_exists boolean,
  risk_rating text check (risk_rating in ('low', 'medium', 'high', 'critical')),
  last_assessment_at date,
  next_assessment_at date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists vendors_tenant_idx on public.vendors (tenant_id);

create trigger vendors_updated_at
  before update on public.vendors
  for each row execute function app.set_updated_at();

-- Link systems to vendors (systems.vendor_id was created without FK in 0007).
alter table public.systems
  drop constraint if exists systems_vendor_id_fkey;
alter table public.systems
  add constraint systems_vendor_id_fkey
  foreign key (vendor_id) references public.vendors(id) on delete set null;

create table if not exists public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_incident_contact boolean not null default false,
  is_24_7 boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  description text,
  critical_service_id uuid references public.critical_services(id) on delete set null,
  system_id uuid references public.systems(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  title text not null,
  contract_number text,
  valid_from date,
  valid_to date,
  incident_reporting_sla_hours numeric(8, 2),
  security_requirements_included boolean,
  storage_path text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger vendor_contracts_updated_at
  before update on public.vendor_contracts
  for each row execute function app.set_updated_at();

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  organization_number text,
  country text,
  services_description text,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  criticality text check (criticality in ('low', 'medium', 'high', 'critical')),
  access_level text check (access_level in ('none', 'limited', 'privileged', 'full')),
  data_types text[],
  dependency_level text check (dependency_level in ('low', 'medium', 'high', 'single_point_of_failure')),
  financial_stability text check (financial_stability in ('strong', 'adequate', 'weak', 'unknown')),
  cyber_maturity text check (cyber_maturity in ('high', 'medium', 'low', 'unknown')),
  incident_history_notes text,
  compliance_evidence_notes text,
  contractual_gaps text,
  overall_risk text check (overall_risk in ('low', 'medium', 'high', 'critical')),
  assessed_by uuid,
  assessed_at timestamptz not null default now(),
  next_assessment_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.outsourced_processing_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  processing_description text not null,
  personal_data boolean not null default false,
  dpa_reference text,
  country text,
  created_at timestamptz not null default now()
);

-- RLS -------------------------------------------------------------------------
alter table public.vendors enable row level security;
alter table public.vendor_contacts enable row level security;
alter table public.vendor_services enable row level security;
alter table public.vendor_contracts enable row level security;
alter table public.subcontractors enable row level security;
alter table public.vendor_risk_assessments enable row level security;
alter table public.outsourced_processing_records enable row level security;

create policy vendors_select on public.vendors
  for select using (app.can_access_tenant(tenant_id));
create policy vendor_contacts_select on public.vendor_contacts
  for select using (app.can_access_tenant(tenant_id));
create policy vendor_services_select on public.vendor_services
  for select using (app.can_access_tenant(tenant_id));
create policy vendor_contracts_select on public.vendor_contracts
  for select using (app.can_access_tenant(tenant_id));
create policy subcontractors_select on public.subcontractors
  for select using (app.can_access_tenant(tenant_id));
create policy vendor_risk_assessments_select on public.vendor_risk_assessments
  for select using (app.can_access_tenant(tenant_id));
create policy outsourced_processing_records_select on public.outsourced_processing_records
  for select using (app.can_access_tenant(tenant_id));
