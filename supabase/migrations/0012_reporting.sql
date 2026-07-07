-- Batch 11–12: Cyberportalen reporting engine, deadlines, reserve procedure
-- and late reporting (spec §18–§21).

create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  report_stage text not null check (report_stage in (
    'early_warning_24h', 'incident_notification_72h', 'final_report',
    'situation_report', 'state_agency_6h', 'imy_report', 'eidas_report'
  )),
  track_code text not null default 'NIS2_CYBERPORTALEN',
  status text not null default 'draft' check (status in (
    'draft', 'ready_for_review', 'approved', 'submitted_in_cyberportalen',
    'cyberportal_incident_id_saved', 'receipt_uploaded', 'late'
  )),
  due_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  submitted_marked_by uuid,
  submitted_marked_at timestamptz,
  submission_method text check (submission_method in (
    'cyberportalen', 'reserve_procedure', 'other'
  )),
  close_override_reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incident_id, report_stage, track_code)
);

create index if not exists incident_reports_tenant_idx on public.incident_reports (tenant_id, status);

create trigger incident_reports_updated_at
  before update on public.incident_reports
  for each row execute function app.set_updated_at();

create table if not exists public.incident_report_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  report_id uuid not null references public.incident_reports(id) on delete cascade,
  field_key text not null,
  value text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, field_key)
);

create trigger incident_report_fields_updated_at
  before update on public.incident_report_fields
  for each row execute function app.set_updated_at();

create table if not exists public.incident_report_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  report_id uuid not null references public.incident_reports(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  submitted_by uuid,
  method text not null default 'cyberportalen' check (method in (
    'cyberportalen', 'reserve_procedure', 'other'
  )),
  notes text,
  created_at timestamptz not null default now()
);

-- Stage-specific Cyberportalen incident IDs (spec §18: new ID may exist per step).
create table if not exists public.cyberportal_incident_ids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  report_id uuid references public.incident_reports(id) on delete set null,
  report_stage text not null,
  cyberportal_id text not null,
  saved_by uuid,
  created_at timestamptz not null default now(),
  unique (incident_id, report_stage)
);

create table if not exists public.report_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  report_id uuid not null references public.incident_reports(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);

-- Reserve procedure (spec §36).
create table if not exists public.reserve_procedure_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete cascade,
  report_id uuid references public.incident_reports(id) on delete set null,
  reason text not null,
  information_classification text not null default 'internal',
  submission_method text check (submission_method in (
    'secure_link', 'registered_mail', 'other_approved'
  )),
  tracking_number text,
  submitted_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Deadlines (spec §19).
create table if not exists public.incident_deadlines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  deadline_type text not null,
  track_code text not null default 'NIS2_CYBERPORTALEN',
  due_at timestamptz not null,
  status text not null default 'pending' check (status in (
    'pending', 'met', 'missed', 'cancelled'
  )),
  met_at timestamptz,
  legal_reference text,
  source_rule_code text,
  is_internal_sla boolean not null default false,
  escalation_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incident_id, deadline_type, track_code)
);

create index if not exists incident_deadlines_due_idx
  on public.incident_deadlines (status, due_at);

create trigger incident_deadlines_updated_at
  before update on public.incident_deadlines
  for each row execute function app.set_updated_at();

-- Late reporting (spec §21).
create table if not exists public.late_reporting_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  deadline_id uuid references public.incident_deadlines(id) on delete set null,
  deadline_type text not null,
  due_at timestamptz not null,
  why_late text,
  first_detected_at timestamptz,
  known_internally_at timestamptz,
  identified_significant_at timestamptz,
  who_knew_what text,
  why_not_identified_earlier text,
  why_not_sent text,
  prevention_actions text,
  explanation_draft text,
  supervisory_explanation_draft text,
  status text not null default 'open' check (status in (
    'open', 'explanation_drafted', 'approved', 'closed'
  )),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger late_reporting_records_updated_at
  before update on public.late_reporting_records
  for each row execute function app.set_updated_at();

-- Report templates (platform content).
create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  report_stage text not null,
  name_sv text not null,
  description_sv text,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger report_templates_updated_at
  before update on public.report_templates
  for each row execute function app.set_updated_at();

create table if not exists public.report_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_templates(id) on delete cascade,
  version text not null,
  content jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  published_by uuid,
  unique (template_id, version)
);

create table if not exists public.language_variants (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_code text not null,
  language text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_code, language)
);

-- RLS -----------------------------------------------------------------------------
alter table public.incident_reports enable row level security;
alter table public.incident_report_fields enable row level security;
alter table public.incident_report_submissions enable row level security;
alter table public.cyberportal_incident_ids enable row level security;
alter table public.report_receipts enable row level security;
alter table public.reserve_procedure_records enable row level security;
alter table public.incident_deadlines enable row level security;
alter table public.late_reporting_records enable row level security;
alter table public.report_templates enable row level security;
alter table public.report_template_versions enable row level security;
alter table public.language_variants enable row level security;

create policy incident_reports_select on public.incident_reports
  for select using (app.can_access_tenant(tenant_id));
create policy incident_report_fields_select on public.incident_report_fields
  for select using (app.can_access_tenant(tenant_id));
create policy incident_report_submissions_select on public.incident_report_submissions
  for select using (app.can_access_tenant(tenant_id));
create policy cyberportal_incident_ids_select on public.cyberportal_incident_ids
  for select using (app.can_access_tenant(tenant_id));
create policy report_receipts_select on public.report_receipts
  for select using (app.can_access_tenant(tenant_id));
create policy reserve_procedure_records_select on public.reserve_procedure_records
  for select using (app.can_access_tenant(tenant_id));
create policy incident_deadlines_select on public.incident_deadlines
  for select using (app.can_access_tenant(tenant_id));
create policy late_reporting_records_select on public.late_reporting_records
  for select using (app.can_access_tenant(tenant_id));
create policy report_templates_select on public.report_templates
  for select using (auth.uid() is not null);
create policy report_template_versions_select on public.report_template_versions
  for select using (auth.uid() is not null);
create policy language_variants_select on public.language_variants
  for select using (auth.uid() is not null);
