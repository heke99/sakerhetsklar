-- Batch 13: parallel reporting tracks — GDPR/IMY, recipients, insurance,
-- contractual reporting, eIDAS/PTS (spec §22–§25).

-- GDPR personal data breach assessment (spec §22).
create table if not exists public.incident_personal_data_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  status text not null default 'not_assessed' check (status in (
    'not_assessed', 'assessment_in_progress', 'report_required',
    'not_report_required', 'submitted_to_imy', 'late',
    'data_subject_notification_required', 'data_subjects_notified'
  )),
  personal_data_involved boolean,
  data_categories text[],
  special_categories boolean,
  data_subjects_count integer,
  disclosed boolean,
  destroyed boolean,
  altered boolean,
  lost boolean,
  unavailable boolean,
  risk_to_rights boolean,
  high_risk boolean,
  imy_notification_required boolean,
  data_subject_notification_required boolean,
  awareness_at timestamptz,
  imy_deadline_at timestamptz,
  submitted_to_imy_at timestamptz,
  not_reporting_reason text,
  not_reporting_approved_by uuid,
  late_reason text,
  dpo_approved_by uuid,
  dpo_approved_at timestamptz,
  assessed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incident_id)
);

create trigger incident_personal_data_assessments_updated_at
  before update on public.incident_personal_data_assessments
  for each row execute function app.set_updated_at();

create table if not exists public.gdpr_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  assessment_id uuid references public.incident_personal_data_assessments(id) on delete set null,
  report_kind text not null default 'imy' check (report_kind in ('imy', 'data_subject_communication')),
  content_draft text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'submitted', 'sent')),
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger gdpr_reports_updated_at
  before update on public.gdpr_reports
  for each row execute function app.set_updated_at();

create table if not exists public.imy_submission_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  submitted_by uuid,
  imy_reference text,
  receipt_storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

-- eIDAS / PTS submissions (spec §23).
create table if not exists public.eidas_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'approved', 'submitted')),
  content_draft text,
  submitted_at timestamptz,
  submitted_by uuid,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger eidas_reports_updated_at
  before update on public.eidas_reports
  for each row execute function app.set_updated_at();

create table if not exists public.pts_submission_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  submitted_by uuid,
  reference text,
  receipt_storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

-- Recipients / customer notification (spec §24).
create table if not exists public.recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  organization_number text,
  contact_email text,
  contact_phone text,
  recipient_group_id uuid,
  notification_preference text default 'email' check (notification_preference in ('email', 'phone', 'portal', 'letter')),
  created_at timestamptz not null default now()
);

create table if not exists public.recipient_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  critical_service_id uuid references public.critical_services(id) on delete set null,
  contractual_notification_hours numeric(8, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.recipient_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  affected_services text,
  affected_recipients text,
  required_action text,
  consequence_if_no_action text,
  decision text not null check (decision in (
    'inform_now', 'wait_would_worsen_handling', 'do_not_inform', 'manual_review'
  )),
  decision_reason text not null,
  message_draft text,
  approved_by uuid,
  approved_by_name text,
  approved_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger recipient_notifications_updated_at
  before update on public.recipient_notifications
  for each row execute function app.set_updated_at();

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  code text not null,
  name_sv text not null,
  body_sv text not null,
  channel text default 'email',
  created_at timestamptz not null default now()
);

-- Insurance (spec §25).
create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  policy_number text,
  incident_contact text,
  notification_deadline_hours numeric(8, 2),
  required_evidence text,
  coverage_notes text,
  valid_from date,
  valid_to date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger insurance_policies_updated_at
  before update on public.insurance_policies
  for each row execute function app.set_updated_at();

create table if not exists public.insurance_notification_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  policy_id uuid references public.insurance_policies(id) on delete set null,
  due_at timestamptz,
  submitted_at timestamptz,
  submitted_by uuid,
  receipt_storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

-- Contractual reporting (spec §25).
create table if not exists public.customer_contract_reporting_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  counterparty_name text not null,
  contract_reference text,
  counterparty_kind text not null default 'customer' check (counterparty_kind in ('customer', 'vendor')),
  reporting_sla_hours numeric(8, 2),
  contact_email text,
  message_template text,
  vendor_id uuid references public.vendors(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.contractual_notification_deadlines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  requirement_id uuid references public.customer_contract_reporting_requirements(id) on delete set null,
  due_at timestamptz,
  submitted_at timestamptz,
  submitted_by uuid,
  receipt_storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

-- RLS -------------------------------------------------------------------------------
alter table public.incident_personal_data_assessments enable row level security;
alter table public.gdpr_reports enable row level security;
alter table public.imy_submission_records enable row level security;
alter table public.eidas_reports enable row level security;
alter table public.pts_submission_records enable row level security;
alter table public.recipients enable row level security;
alter table public.recipient_groups enable row level security;
alter table public.recipient_notifications enable row level security;
alter table public.message_templates enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.insurance_notification_requirements enable row level security;
alter table public.customer_contract_reporting_requirements enable row level security;
alter table public.contractual_notification_deadlines enable row level security;

create policy incident_personal_data_assessments_select on public.incident_personal_data_assessments
  for select using (app.can_access_tenant(tenant_id));
create policy gdpr_reports_select on public.gdpr_reports
  for select using (app.can_access_tenant(tenant_id));
create policy imy_submission_records_select on public.imy_submission_records
  for select using (app.can_access_tenant(tenant_id));
create policy eidas_reports_select on public.eidas_reports
  for select using (app.can_access_tenant(tenant_id));
create policy pts_submission_records_select on public.pts_submission_records
  for select using (app.can_access_tenant(tenant_id));
create policy recipients_select on public.recipients
  for select using (app.can_access_tenant(tenant_id));
create policy recipient_groups_select on public.recipient_groups
  for select using (app.can_access_tenant(tenant_id));
create policy recipient_notifications_select on public.recipient_notifications
  for select using (app.can_access_tenant(tenant_id));
create policy message_templates_select on public.message_templates
  for select using (tenant_id is null or app.can_access_tenant(tenant_id));
create policy insurance_policies_select on public.insurance_policies
  for select using (app.can_access_tenant(tenant_id));
create policy insurance_notification_requirements_select on public.insurance_notification_requirements
  for select using (app.can_access_tenant(tenant_id));
create policy customer_contract_reporting_requirements_select on public.customer_contract_reporting_requirements
  for select using (app.can_access_tenant(tenant_id));
create policy contractual_notification_deadlines_select on public.contractual_notification_deadlines
  for select using (app.can_access_tenant(tenant_id));
