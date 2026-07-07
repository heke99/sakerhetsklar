-- Batch 10: significance assessments and regulatory track linkage.

create table if not exists public.incident_significance_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  facts jsonb not null default '{}'::jsonb,
  recommendation text not null check (recommendation in (
    'not_reportable', 'monitor', 'potentially_significant',
    'significant_reportable', 'manual_review_required'
  )),
  rule_coverage_partial boolean not null default false,
  also_assess_gdpr boolean not null default false,
  also_assess_pts boolean not null default false,
  also_assess_eidas boolean not null default false,
  also_assess_contracts boolean not null default false,
  also_assess_insurance boolean not null default false,
  also_assess_state_agency boolean not null default false,
  matched_rules jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  missing_facts jsonb not null default '[]'::jsonb,
  legal_references jsonb not null default '[]'::jsonb,
  confidence text not null default 'medium' check (confidence in ('high', 'medium', 'low')),
  required_approver_roles text[] not null default '{}',
  next_steps jsonb not null default '[]'::jsonb,
  deadline_definitions jsonb not null default '[]'::jsonb,
  rule_package_versions jsonb not null default '{}'::jsonb,
  assessed_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  approval_status text not null default 'pending' check (approval_status in (
    'pending', 'approved', 'rejected', 'superseded'
  )),
  created_at timestamptz not null default now()
);

create index if not exists incident_significance_assessments_incident_idx
  on public.incident_significance_assessments (incident_id, created_at desc);

-- Which regulatory tracks apply to an incident (NIS2, GDPR, eIDAS, ...).
create table if not exists public.incident_regulatory_tracks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  track_code text not null,
  status text not null default 'open' check (status in (
    'open', 'assessment_in_progress', 'reporting_required', 'not_required',
    'submitted', 'closed', 'late'
  )),
  reason text,
  opened_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incident_id, track_code)
);

create trigger incident_regulatory_tracks_updated_at
  before update on public.incident_regulatory_tracks
  for each row execute function app.set_updated_at();

alter table public.incident_significance_assessments enable row level security;
alter table public.incident_regulatory_tracks enable row level security;

create policy incident_significance_assessments_select on public.incident_significance_assessments
  for select using (app.can_access_tenant(tenant_id));
create policy incident_regulatory_tracks_select on public.incident_regulatory_tracks
  for select using (app.can_access_tenant(tenant_id));
