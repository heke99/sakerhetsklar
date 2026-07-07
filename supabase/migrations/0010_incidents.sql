-- Batch 9: incident module — incidents, events/timeline, impacts, tasks,
-- comments, decision logs and status engine (spec §15, §19 timestamps).

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete set null,
  reference text not null,                     -- human-readable e.g. INC-2026-0001
  title text not null,
  description text,
  status text not null default 'new' check (status in (
    'new', 'triage', 'investigating', 'contained', 'resolved', 'closed'
  )),
  severity text not null default 'medium' check (severity in (
    'low', 'medium', 'high', 'critical'
  )),
  incident_type text,                          -- ransomware, outage, data_leak, ot_incident, supplier, other
  is_ongoing boolean not null default true,
  suspected_malicious boolean,
  supplier_origin boolean,
  cross_border_effects boolean,
  personal_data_possibly_affected boolean,
  protected_information_possibly_affected boolean,
  -- Deadline engine timestamps (spec §19).
  incident_started_at timestamptz,
  incident_detected_at timestamptz,
  incident_known_at timestamptz,
  identified_as_significant_at timestamptz,
  incident_ended_at timestamptz,
  -- Significance summary (detail in incident_significance_assessments).
  significance_status text not null default 'not_assessed' check (significance_status in (
    'not_assessed', 'assessment_in_progress', 'not_reportable', 'monitor',
    'potentially_significant', 'significant_reportable', 'manual_review_required'
  )),
  detection_method text,
  reported_by uuid,
  incident_manager_user_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, reference)
);

create index if not exists incidents_tenant_idx on public.incidents (tenant_id, status);

create trigger incidents_updated_at
  before update on public.incidents
  for each row execute function app.set_updated_at();

-- Timeline events (also acts as immutable incident log).
create table if not exists public.incident_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  event_type text not null,          -- created, status_changed, note, impact_added, assessment_run, report_generated, ...
  title text not null,
  detail text,
  occurred_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists incident_events_incident_idx
  on public.incident_events (incident_id, occurred_at);

-- Status history.
create table if not exists public.incident_statuses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

-- Impacts.
create table if not exists public.incident_system_impacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  system_id uuid not null references public.systems(id) on delete cascade,
  impact_type text not null default 'unavailable' check (impact_type in (
    'unavailable', 'degraded', 'integrity_compromised', 'confidentiality_compromised', 'unknown'
  )),
  started_at timestamptz,
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (incident_id, system_id)
);

create table if not exists public.incident_service_impacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  critical_service_id uuid not null references public.critical_services(id) on delete cascade,
  impact_type text not null default 'unavailable' check (impact_type in (
    'unavailable', 'degraded', 'unknown'
  )),
  affected_users_estimate integer,
  geographic_area text,
  started_at timestamptz,
  ended_at timestamptz,
  manual_workaround_active boolean,
  manual_workaround_started_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (incident_id, critical_service_id)
);

create table if not exists public.incident_vendor_impacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  role text not null default 'affected' check (role in ('origin', 'affected', 'supporting')),
  vendor_notified_at timestamptz,
  vendor_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (incident_id, vendor_id)
);

-- Structured impact facts used by the significance engine.
create table if not exists public.incident_impact_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  facts jsonb not null default '{}'::jsonb,
  assessed_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_protected_information_impacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  protected_information_asset_id uuid references public.protected_information_assets(id) on delete set null,
  impact text not null check (impact in ('accessed_by_unauthorized', 'altered', 'destroyed', 'suspected', 'none')),
  belongs_to_other_legal_person boolean,
  at_least_500_natural_persons boolean,
  notes text,
  created_at timestamptz not null default now()
);

-- Decision log (spec §43): every important incident decision is recorded.
create table if not exists public.incident_decision_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  decision text not null,
  options_considered text,
  selected_option text,
  reason text,
  approver_user_id uuid,
  approver_name text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Tasks and comments.
create table if not exists public.incident_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  title text not null,
  description text,
  assigned_to_name text,
  assigned_to_user_id uuid,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  task_type text,                     -- e.g. 'report_review', 'late_explanation', 'containment'
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incident_tasks_incident_idx on public.incident_tasks (incident_id, status);

create trigger incident_tasks_updated_at
  before update on public.incident_tasks
  for each row execute function app.set_updated_at();

create table if not exists public.incident_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  body text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

-- Incident reference sequence per tenant.
create or replace function app.next_incident_reference(target_tenant uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
begin
  select count(*) + 1 into seq from public.incidents where tenant_id = target_tenant;
  return 'INC-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- RLS ---------------------------------------------------------------------------
alter table public.incidents enable row level security;
alter table public.incident_events enable row level security;
alter table public.incident_statuses enable row level security;
alter table public.incident_system_impacts enable row level security;
alter table public.incident_service_impacts enable row level security;
alter table public.incident_vendor_impacts enable row level security;
alter table public.incident_impact_assessments enable row level security;
alter table public.incident_protected_information_impacts enable row level security;
alter table public.incident_decision_logs enable row level security;
alter table public.incident_tasks enable row level security;
alter table public.incident_comments enable row level security;

create policy incidents_select on public.incidents
  for select using (app.can_access_tenant(tenant_id));
create policy incident_events_select on public.incident_events
  for select using (app.can_access_tenant(tenant_id));
create policy incident_statuses_select on public.incident_statuses
  for select using (app.can_access_tenant(tenant_id));
create policy incident_system_impacts_select on public.incident_system_impacts
  for select using (app.can_access_tenant(tenant_id));
create policy incident_service_impacts_select on public.incident_service_impacts
  for select using (app.can_access_tenant(tenant_id));
create policy incident_vendor_impacts_select on public.incident_vendor_impacts
  for select using (app.can_access_tenant(tenant_id));
create policy incident_impact_assessments_select on public.incident_impact_assessments
  for select using (app.can_access_tenant(tenant_id));
create policy incident_protected_information_impacts_select on public.incident_protected_information_impacts
  for select using (app.can_access_tenant(tenant_id));
create policy incident_decision_logs_select on public.incident_decision_logs
  for select using (app.can_access_tenant(tenant_id));
create policy incident_tasks_select on public.incident_tasks
  for select using (app.can_access_tenant(tenant_id));
create policy incident_comments_select on public.incident_comments
  for select using (app.can_access_tenant(tenant_id));
