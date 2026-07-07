-- Batch 5: sectors detail, supervisory authorities, scope assessments,
-- SME size assessments, classification, registration support, onboarding
-- and group structure.

-- ---------------------------------------------------------------------------
-- Sector reference data.
-- ---------------------------------------------------------------------------
create table if not exists public.subsectors (
  id uuid primary key default gen_random_uuid(),
  sector_code text not null references public.sectors(code) on delete cascade,
  code text not null unique,
  name_sv text not null,
  name_en text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_types (
  id uuid primary key default gen_random_uuid(),
  sector_code text references public.sectors(code) on delete cascade,
  subsector_code text references public.subsectors(code) on delete cascade,
  code text not null unique,
  name_sv text not null,
  name_en text,
  created_at timestamptz not null default now()
);

create table if not exists public.entity_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_sv text not null,
  name_en text,
  is_public_body boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sector_annex_mappings (
  id uuid primary key default gen_random_uuid(),
  sector_code text not null references public.sectors(code) on delete cascade,
  annex text not null check (annex in ('annex_1', 'annex_2', 'special')),
  source_reference text,
  created_at timestamptz not null default now(),
  unique (sector_code, annex)
);

-- ---------------------------------------------------------------------------
-- Supervisory authorities and mapping.
-- ---------------------------------------------------------------------------
create table if not exists public.supervisory_authorities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_sv text not null,
  name_en text,
  website text,
  is_regional boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sector_supervisory_authorities (
  id uuid primary key default gen_random_uuid(),
  sector_code text not null references public.sectors(code) on delete cascade,
  subsector_code text references public.subsectors(code) on delete set null,
  authority_code text not null references public.supervisory_authorities(code) on delete cascade,
  condition_note_sv text,
  source_reference text,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (sector_code, subsector_code, authority_code)
);

create table if not exists public.authority_region_mappings (
  id uuid primary key default gen_random_uuid(),
  authority_code text not null references public.supervisory_authorities(code) on delete cascade,
  region_code text not null,     -- Swedish county code, e.g. 'AB' Stockholm
  region_name_sv text not null,
  created_at timestamptz not null default now(),
  unique (authority_code, region_code)
);

-- ---------------------------------------------------------------------------
-- Group structure.
-- ---------------------------------------------------------------------------
create table if not exists public.company_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  parent_company_name text,
  parent_organization_number text,
  include_group_in_size_assessment boolean not null default false,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_groups_updated_at
  before update on public.company_groups
  for each row execute function app.set_updated_at();

create table if not exists public.ownership_relations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid references public.company_groups(id) on delete cascade,
  owner_legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  owned_legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  ownership_percent numeric(5, 2),
  relation_type text not null default 'subsidiary' check (relation_type in (
    'parent', 'subsidiary', 'linked', 'partner'
  )),
  created_at timestamptz not null default now()
);

create table if not exists public.linked_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  organization_number text,
  relation_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  organization_number text,
  relation_note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Scope assessment (wizard runs) and results.
-- ---------------------------------------------------------------------------
create table if not exists public.scope_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  status text not null default 'in_progress' check (status in (
    'in_progress', 'completed', 'superseded'
  )),
  started_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scope_assessments_tenant_idx on public.scope_assessments (tenant_id);

create trigger scope_assessments_updated_at
  before update on public.scope_assessments
  for each row execute function app.set_updated_at();

create table if not exists public.scope_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.scope_assessments(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  question_key text not null,
  answer jsonb not null,
  answered_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, question_key)
);

create trigger scope_answers_updated_at
  before update on public.scope_answers
  for each row execute function app.set_updated_at();

create table if not exists public.scope_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.scope_assessments(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  likely_covered text not null check (likely_covered in ('yes', 'no', 'manual_review')),
  classification text check (classification in (
    'essential', 'important', 'public', 'manual_review'
  )),
  sectors text[] not null default '{}',
  subsectors text[] not null default '{}',
  supervisory_authorities text[] not null default '{}',
  active_rule_packages text[] not null default '{}',
  pending_rule_packages text[] not null default '{}',
  manual_review_reasons jsonb not null default '[]'::jsonb,
  matched_rules jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  confidence text not null default 'medium' check (confidence in ('high', 'medium', 'low')),
  next_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Size and jurisdiction assessments, classification decisions.
-- ---------------------------------------------------------------------------
create table if not exists public.entity_size_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  employees integer,
  annual_turnover_eur numeric(16, 2),
  balance_sheet_total_eur numeric(16, 2),
  annual_turnover_sek numeric(16, 2),
  balance_sheet_total_sek numeric(16, 2),
  financial_year integer,
  group_employees integer,
  group_turnover_eur numeric(16, 2),
  group_balance_sheet_total_eur numeric(16, 2),
  include_group boolean not null default false,
  size_class text check (size_class in ('micro', 'small', 'medium', 'large')),
  calculation jsonb,
  assessed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger entity_size_assessments_updated_at
  before update on public.entity_size_assessments
  for each row execute function app.set_updated_at();

create table if not exists public.jurisdiction_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  country_code text not null default 'SE',
  established_in_sweden boolean,
  provides_services_in_sweden boolean,
  main_establishment_country text,
  cross_border_notes text,
  result text check (result in ('swedish_jurisdiction', 'other_eu', 'manual_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger jurisdiction_assessments_updated_at
  before update on public.jurisdiction_assessments
  for each row execute function app.set_updated_at();

create table if not exists public.essential_important_classifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  classification text not null check (classification in (
    'essential', 'important', 'public', 'manual_review', 'not_covered'
  )),
  basis jsonb not null default '[]'::jsonb,
  matched_rules jsonb not null default '[]'::jsonb,
  decided_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  manual_override boolean not null default false,
  override_reason text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger essential_important_classifications_updated_at
  before update on public.essential_important_classifications
  for each row execute function app.set_updated_at();

-- Supervisory authority assignment per tenant (with manual override support).
create table if not exists public.tenant_supervisory_authorities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  authority_code text not null references public.supervisory_authorities(code),
  sector_code text,
  is_manual_override boolean not null default false,
  override_reason text,
  source_reference text,
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, authority_code, sector_code)
);

-- ---------------------------------------------------------------------------
-- Registration support (MCFFS 2026:1).
-- ---------------------------------------------------------------------------
create table if not exists public.registration_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  registration_type text not null default 'initial' check (registration_type in (
    'initial', 'change', 'deregistration'
  )),
  status text not null default 'not_started' check (status in (
    'not_started', 'data_collection', 'ready_to_submit', 'submitted', 'confirmed'
  )),
  checklist jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  submitted_by uuid,
  authority_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger registration_records_updated_at
  before update on public.registration_records
  for each row execute function app.set_updated_at();

create table if not exists public.registration_receipts (
  id uuid primary key default gen_random_uuid(),
  registration_record_id uuid not null references public.registration_records(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.registration_change_logs (
  id uuid primary key default gen_random_uuid(),
  registration_record_id uuid references public.registration_records(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  change_summary text not null,
  change_detected_at timestamptz not null default now(),
  -- MCFFS 2026:1: changes must be notified within 14 days where relevant.
  notify_by date,
  notified_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'notified', 'not_required')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Onboarding.
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  step_key text not null unique,
  title_sv text not null,
  description_sv text,
  sort_order integer not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  step_key text not null references public.onboarding_steps(step_key) on delete cascade,
  status text not null default 'not_started' check (status in (
    'not_started', 'in_progress', 'completed', 'skipped', 'blocked'
  )),
  completed_by uuid,
  completed_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, step_key)
);

create trigger onboarding_progress_updated_at
  before update on public.onboarding_progress
  for each row execute function app.set_updated_at();

create table if not exists public.onboarding_blockers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  step_key text,
  description_sv text not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS.
-- ---------------------------------------------------------------------------
alter table public.subsectors enable row level security;
alter table public.activity_types enable row level security;
alter table public.entity_types enable row level security;
alter table public.sector_annex_mappings enable row level security;
alter table public.supervisory_authorities enable row level security;
alter table public.sector_supervisory_authorities enable row level security;
alter table public.authority_region_mappings enable row level security;
alter table public.company_groups enable row level security;
alter table public.ownership_relations enable row level security;
alter table public.linked_companies enable row level security;
alter table public.partner_companies enable row level security;
alter table public.scope_assessments enable row level security;
alter table public.scope_answers enable row level security;
alter table public.scope_results enable row level security;
alter table public.entity_size_assessments enable row level security;
alter table public.jurisdiction_assessments enable row level security;
alter table public.essential_important_classifications enable row level security;
alter table public.tenant_supervisory_authorities enable row level security;
alter table public.registration_records enable row level security;
alter table public.registration_receipts enable row level security;
alter table public.registration_change_logs enable row level security;
alter table public.onboarding_steps enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.onboarding_blockers enable row level security;

-- Reference data: readable by authenticated users.
create policy subsectors_select on public.subsectors
  for select using (auth.uid() is not null);
create policy activity_types_select on public.activity_types
  for select using (auth.uid() is not null);
create policy entity_types_select on public.entity_types
  for select using (auth.uid() is not null);
create policy sector_annex_mappings_select on public.sector_annex_mappings
  for select using (auth.uid() is not null);
create policy supervisory_authorities_select on public.supervisory_authorities
  for select using (auth.uid() is not null);
create policy sector_supervisory_authorities_select on public.sector_supervisory_authorities
  for select using (auth.uid() is not null);
create policy authority_region_mappings_select on public.authority_region_mappings
  for select using (auth.uid() is not null);
create policy onboarding_steps_select on public.onboarding_steps
  for select using (auth.uid() is not null);

-- Tenant-scoped data: members read, writes via service layer.
create policy company_groups_select on public.company_groups
  for select using (app.can_access_tenant(tenant_id));
create policy ownership_relations_select on public.ownership_relations
  for select using (app.can_access_tenant(tenant_id));
create policy linked_companies_select on public.linked_companies
  for select using (app.can_access_tenant(tenant_id));
create policy partner_companies_select on public.partner_companies
  for select using (app.can_access_tenant(tenant_id));
create policy scope_assessments_select on public.scope_assessments
  for select using (app.can_access_tenant(tenant_id));
create policy scope_answers_select on public.scope_answers
  for select using (app.can_access_tenant(tenant_id));
create policy scope_results_select on public.scope_results
  for select using (app.can_access_tenant(tenant_id));
create policy entity_size_assessments_select on public.entity_size_assessments
  for select using (app.can_access_tenant(tenant_id));
create policy jurisdiction_assessments_select on public.jurisdiction_assessments
  for select using (app.can_access_tenant(tenant_id));
create policy essential_important_classifications_select on public.essential_important_classifications
  for select using (app.can_access_tenant(tenant_id));
create policy tenant_supervisory_authorities_select on public.tenant_supervisory_authorities
  for select using (app.can_access_tenant(tenant_id));
create policy registration_records_select on public.registration_records
  for select using (app.can_access_tenant(tenant_id));
create policy registration_receipts_select on public.registration_receipts
  for select using (app.can_access_tenant(tenant_id));
create policy registration_change_logs_select on public.registration_change_logs
  for select using (app.can_access_tenant(tenant_id));
create policy onboarding_progress_select on public.onboarding_progress
  for select using (app.can_access_tenant(tenant_id));
create policy onboarding_blockers_select on public.onboarding_blockers
  for select using (app.can_access_tenant(tenant_id));
