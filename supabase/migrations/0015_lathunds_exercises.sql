-- Batch 15: lathund library (clickable workflows), tabletop exercises and
-- continuity/DR module (spec §28, §33, §34).

create table if not exists public.lathunds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title_sv text not null,
  purpose_sv text,
  applicable_sectors text[] not null default '{}',
  applicable_rule_packages text[] not null default '{}',
  outputs_sv text,
  version text not null default '1.0.0',
  source_references text,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger lathunds_updated_at
  before update on public.lathunds
  for each row execute function app.set_updated_at();

create table if not exists public.lathund_steps (
  id uuid primary key default gen_random_uuid(),
  lathund_id uuid not null references public.lathunds(id) on delete cascade,
  step_number integer not null,
  title_sv text not null,
  description_sv text,
  required_fields jsonb not null default '[]'::jsonb,
  optional_fields jsonb not null default '[]'::jsonb,
  link_path text,
  created_at timestamptz not null default now(),
  unique (lathund_id, step_number)
);

create table if not exists public.lathund_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lathund_id uuid not null references public.lathunds(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete set null,
  started_by uuid,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger lathund_runs_updated_at
  before update on public.lathund_runs
  for each row execute function app.set_updated_at();

create table if not exists public.lathund_run_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_id uuid not null references public.lathund_runs(id) on delete cascade,
  step_id uuid not null references public.lathund_steps(id) on delete cascade,
  completed boolean not null default false,
  completed_by uuid,
  completed_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, step_id)
);

-- Exercises (spec §34).
create table if not exists public.exercise_scenarios (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title_sv text not null,
  description_sv text,
  scenario_type text not null,
  applicable_sectors text[] not null default '{}',
  inject_script jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  scenario_id uuid not null references public.exercise_scenarios(id) on delete cascade,
  participants text[],
  started_at timestamptz,
  ended_at timestamptz,
  decisions text,
  minutes_to_classify integer,
  minutes_to_draft_report integer,
  missed_steps text,
  score integer check (score between 0 and 100),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger exercise_runs_updated_at
  before update on public.exercise_runs
  for each row execute function app.set_updated_at();

create table if not exists public.exercise_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exercise_run_id uuid not null references public.exercise_runs(id) on delete cascade,
  finding text not null,
  severity text check (severity in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_action_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exercise_run_id uuid not null references public.exercise_runs(id) on delete cascade,
  action text not null,
  responsible_name text,
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);

-- Continuity / DR (spec §33).
create table if not exists public.business_continuity_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  critical_service_id uuid references public.critical_services(id) on delete set null,
  owner_name text,
  rto_hours numeric(8, 2),
  rpo_hours numeric(8, 2),
  fallback_procedure text,
  manual_workaround text,
  communication_plan text,
  last_test date,
  next_test date,
  findings text,
  action_plan text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger business_continuity_plans_updated_at
  before update on public.business_continuity_plans
  for each row execute function app.set_updated_at();

create table if not exists public.disaster_recovery_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  system_id uuid references public.systems(id) on delete set null,
  owner_name text,
  recovery_procedure text,
  last_test date,
  next_test date,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_tests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  system_id uuid references public.systems(id) on delete set null,
  tested_at date not null,
  result text not null check (result in ('pass', 'partial', 'fail')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.restore_tests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  system_id uuid references public.systems(id) on delete set null,
  tested_at date not null,
  result text not null check (result in ('pass', 'partial', 'fail')),
  duration_minutes integer,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.manual_workarounds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  critical_service_id uuid references public.critical_services(id) on delete set null,
  name text not null,
  description text,
  max_duration_hours numeric(8, 2),
  last_tested date,
  created_at timestamptz not null default now()
);

-- RLS ---------------------------------------------------------------------------------
alter table public.lathunds enable row level security;
alter table public.lathund_steps enable row level security;
alter table public.lathund_runs enable row level security;
alter table public.lathund_run_steps enable row level security;
alter table public.exercise_scenarios enable row level security;
alter table public.exercise_runs enable row level security;
alter table public.exercise_findings enable row level security;
alter table public.exercise_action_plans enable row level security;
alter table public.business_continuity_plans enable row level security;
alter table public.disaster_recovery_plans enable row level security;
alter table public.backup_tests enable row level security;
alter table public.restore_tests enable row level security;
alter table public.manual_workarounds enable row level security;

create policy lathunds_select on public.lathunds
  for select using (auth.uid() is not null);
create policy lathund_steps_select on public.lathund_steps
  for select using (auth.uid() is not null);
create policy exercise_scenarios_select on public.exercise_scenarios
  for select using (auth.uid() is not null);

create policy lathund_runs_select on public.lathund_runs
  for select using (app.can_access_tenant(tenant_id));
create policy lathund_run_steps_select on public.lathund_run_steps
  for select using (app.can_access_tenant(tenant_id));
create policy exercise_runs_select on public.exercise_runs
  for select using (app.can_access_tenant(tenant_id));
create policy exercise_findings_select on public.exercise_findings
  for select using (app.can_access_tenant(tenant_id));
create policy exercise_action_plans_select on public.exercise_action_plans
  for select using (app.can_access_tenant(tenant_id));
create policy business_continuity_plans_select on public.business_continuity_plans
  for select using (app.can_access_tenant(tenant_id));
create policy disaster_recovery_plans_select on public.disaster_recovery_plans
  for select using (app.can_access_tenant(tenant_id));
create policy backup_tests_select on public.backup_tests
  for select using (app.can_access_tenant(tenant_id));
create policy restore_tests_select on public.restore_tests
  for select using (app.can_access_tenant(tenant_id));
create policy manual_workarounds_select on public.manual_workarounds
  for select using (app.can_access_tenant(tenant_id));
