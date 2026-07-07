-- Batch 8: control library, tenant controls, risks, action plans, data
-- quality and management training (spec §29).

-- Control requirement library (global reference data, linked to legal rules).
create table if not exists public.control_requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  area text not null,
  title_sv text not null,
  description_sv text,
  source_rule_set_code text,
  legal_reference text,
  evidence_required boolean not null default true,
  default_owner_role text,
  applicable_classifications text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'draft', 'pending_guidance', 'archived')),
  effective_from date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Tenant control instances.
create table if not exists public.controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requirement_id uuid references public.control_requirements(id) on delete set null,
  code text not null,
  area text,
  title_sv text not null,
  description_sv text,
  legal_reference text,
  owner_role text,
  assigned_user_id uuid,
  assigned_user_name text,
  status text not null default 'not_started' check (status in (
    'not_started', 'in_progress', 'evidence_required', 'ready_for_review',
    'approved', 'overdue', 'risk_accepted', 'not_applicable'
  )),
  risk_level text check (risk_level in ('low', 'medium', 'high', 'critical')),
  evidence_required boolean not null default true,
  evidence_uploaded boolean not null default false,
  deadline date,
  last_reviewed_at timestamptz,
  next_review_at date,
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, code)
);

create index if not exists controls_tenant_idx on public.controls (tenant_id, status);

create trigger controls_updated_at
  before update on public.controls
  for each row execute function app.set_updated_at();

create table if not exists public.control_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete cascade,
  user_id uuid,
  user_name text,
  role text,
  assigned_by uuid,
  assigned_at timestamptz not null default now()
);

-- Evidence linkage; FK to evidence added when the evidence bank is created.
create table if not exists public.control_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete cascade,
  evidence_id uuid,
  note text,
  linked_by uuid,
  created_at timestamptz not null default now()
);

-- Risks ------------------------------------------------------------------------
create table if not exists public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  scope_description text,
  methodology text,
  performed_by uuid,
  performed_at timestamptz not null default now(),
  next_assessment_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  risk_assessment_id uuid references public.risk_assessments(id) on delete set null,
  title text not null,
  description text,
  category text,
  likelihood integer check (likelihood between 1 and 5),
  impact integer check (impact between 1 and 5),
  risk_level text check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in (
    'open', 'treatment_planned', 'treatment_in_progress', 'mitigated', 'accepted', 'closed'
  )),
  owner_user_id uuid,
  owner_name text,
  linked_system_id uuid references public.systems(id) on delete set null,
  linked_vendor_id uuid references public.vendors(id) on delete set null,
  linked_control_id uuid references public.controls(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists risks_tenant_idx on public.risks (tenant_id, status);

create trigger risks_updated_at
  before update on public.risks
  for each row execute function app.set_updated_at();

create table if not exists public.risk_treatments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  treatment text not null,
  responsible_name text,
  due_date date,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.risk_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  risk_id uuid references public.risks(id) on delete cascade,
  control_id uuid references public.controls(id) on delete set null,
  reason text not null,
  accepted_by uuid,
  accepted_by_name text,
  accepted_at timestamptz not null default now(),
  valid_until date,
  created_at timestamptz not null default now()
);

create table if not exists public.action_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  source text,           -- e.g. 'control_gap', 'incident', 'exercise', 'audit'
  source_id uuid,
  responsible_name text,
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger action_plans_updated_at
  before update on public.action_plans
  for each row execute function app.set_updated_at();

-- Management training (spec §35, MCFFS 2026:11) ---------------------------------
create table if not exists public.management_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  role text,
  is_board_member boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.management_training_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  management_member_id uuid references public.management_members(id) on delete cascade,
  training_name text not null,
  completed_at date,
  valid_until date,
  evidence_note text,
  created_at timestamptz not null default now()
);

-- Data quality -------------------------------------------------------------------
create table if not exists public.data_quality_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title_sv text not null,
  description_sv text,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  link_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.data_quality_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_code text not null references public.data_quality_rules(code) on delete cascade,
  entity_type text,
  entity_id uuid,
  detail text,
  resolved boolean not null default false,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists data_quality_findings_tenant_idx
  on public.data_quality_findings (tenant_id, resolved);

create table if not exists public.required_field_completeness (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  total_count integer not null default 0,
  complete_count integer not null default 0,
  computed_at timestamptz not null default now(),
  unique (tenant_id, entity_type)
);

-- RLS -----------------------------------------------------------------------------
alter table public.control_requirements enable row level security;
alter table public.controls enable row level security;
alter table public.control_assignments enable row level security;
alter table public.control_evidence enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.risks enable row level security;
alter table public.risk_treatments enable row level security;
alter table public.risk_acceptances enable row level security;
alter table public.action_plans enable row level security;
alter table public.management_members enable row level security;
alter table public.management_training_records enable row level security;
alter table public.data_quality_rules enable row level security;
alter table public.data_quality_findings enable row level security;
alter table public.required_field_completeness enable row level security;

create policy control_requirements_select on public.control_requirements
  for select using (auth.uid() is not null);
create policy data_quality_rules_select on public.data_quality_rules
  for select using (auth.uid() is not null);

create policy controls_select on public.controls
  for select using (app.can_access_tenant(tenant_id));
create policy control_assignments_select on public.control_assignments
  for select using (app.can_access_tenant(tenant_id));
create policy control_evidence_select on public.control_evidence
  for select using (app.can_access_tenant(tenant_id));
create policy risk_assessments_select on public.risk_assessments
  for select using (app.can_access_tenant(tenant_id));
create policy risks_select on public.risks
  for select using (app.can_access_tenant(tenant_id));
create policy risk_treatments_select on public.risk_treatments
  for select using (app.can_access_tenant(tenant_id));
create policy risk_acceptances_select on public.risk_acceptances
  for select using (app.can_access_tenant(tenant_id));
create policy action_plans_select on public.action_plans
  for select using (app.can_access_tenant(tenant_id));
create policy management_members_select on public.management_members
  for select using (app.can_access_tenant(tenant_id));
create policy management_training_records_select on public.management_training_records
  for select using (app.can_access_tenant(tenant_id));
create policy data_quality_findings_select on public.data_quality_findings
  for select using (app.can_access_tenant(tenant_id));
create policy required_field_completeness_select on public.required_field_completeness
  for select using (app.can_access_tenant(tenant_id));
