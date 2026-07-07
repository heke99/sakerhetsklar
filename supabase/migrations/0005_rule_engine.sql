-- Batch 4: versioned rule engine — legal sources, rules, versions, coverage,
-- regulatory tracks and report field definitions.
--
-- Core principle: legal/rule logic is never hardcoded in the frontend. Every
-- rule carries its source, legal reference, effectivity, status and coverage.

-- ---------------------------------------------------------------------------
-- Legal sources and documents.
-- ---------------------------------------------------------------------------
create table if not exists public.legal_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_sv text not null,
  name_en text,
  source_type text not null check (source_type in (
    'law', 'ordinance', 'agency_regulation', 'eu_regulation', 'eu_directive',
    'guidance', 'contract_framework', 'internal'
  )),
  publisher text,
  official_number text,
  url text,
  published_date date,
  effective_date date,
  status text not null default 'active' check (status in (
    'active', 'draft', 'pending', 'replaced', 'repealed', 'archived'
  )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger legal_sources_updated_at
  before update on public.legal_sources
  for each row execute function app.set_updated_at();

create table if not exists public.legal_source_documents (
  id uuid primary key default gen_random_uuid(),
  legal_source_id uuid not null references public.legal_sources(id) on delete cascade,
  title text not null,
  document_type text not null default 'full_text'
    check (document_type in ('full_text', 'excerpt', 'guidance', 'faq', 'annex')),
  url text,
  storage_path text,
  version text,
  language text not null default 'sv',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Extend rule sets with coverage and source linkage.
-- ---------------------------------------------------------------------------
alter table public.regulatory_rule_sets
  add column if not exists coverage_status text not null default 'fully_supported'
    check (coverage_status in (
      'fully_supported', 'partially_supported', 'unsupported',
      'requires_manual_review', 'pending_regulatory_guidance'
    )),
  add column if not exists requires_update_when_final boolean not null default false,
  add column if not exists manual_review_required boolean not null default false,
  add column if not exists legal_source_id uuid references public.legal_sources(id),
  add column if not exists description_sv text,
  add column if not exists upload_warning boolean not null default false;

-- Rule set status also needs draft/pending values (0001 allowed free text; add
-- an explicit constraint now).
alter table public.regulatory_rule_sets
  drop constraint if exists regulatory_rule_sets_status_check;
alter table public.regulatory_rule_sets
  add constraint regulatory_rule_sets_status_check check (status in (
    'active', 'draft', 'pending_guidance', 'replaced', 'repealed', 'archived',
    'manual_review_required'
  ));

-- ---------------------------------------------------------------------------
-- Individual rules. Conditions/params are a JSON DSL evaluated by the rule
-- engine (src/lib/rule-engine). Thresholds are editable data — not code.
-- ---------------------------------------------------------------------------
create table if not exists public.regulatory_rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.regulatory_rule_sets(id) on delete cascade,
  rule_code text not null,
  title_sv text not null,
  title_en text,
  description_sv text,
  rule_type text not null check (rule_type in (
    'coverage',                -- is the entity covered?
    'classification',          -- essential/important/public
    'significance_threshold',  -- incident significance criteria
    'deadline',                -- reporting deadline rule
    'reporting_requirement',   -- what must be reported
    'control_requirement',     -- required security measures
    'flag',                    -- manual review flags (CER/DORA/security protection)
    'recurring_incident'       -- recurring incident aggregation
  )),
  applicable_sectors text[] not null default '{}',      -- empty = all sectors
  applicable_subsectors text[] not null default '{}',
  applicable_entity_types text[] not null default '{}', -- empty = all
  applicable_classifications text[] not null default '{}', -- essential/important/public
  applicable_deployment_models text[] not null default '{}',
  condition jsonb,             -- JSON condition DSL
  params jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  legal_reference text,        -- e.g. 'MCFFS 2026:8 3 kap. 2 §'
  source_quote text,
  status text not null default 'active' check (status in (
    'active', 'draft', 'pending_guidance', 'replaced', 'repealed', 'archived'
  )),
  coverage_status text not null default 'fully_supported' check (coverage_status in (
    'fully_supported', 'partially_supported', 'unsupported',
    'requires_manual_review', 'pending_regulatory_guidance'
  )),
  confidence text not null default 'high' check (confidence in ('high', 'medium', 'low')),
  required_approver_role text,
  effective_from date,
  effective_to date,
  version integer not null default 1,
  sort_order integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_set_id, rule_code)
);

create index if not exists regulatory_rules_set_idx on public.regulatory_rules (rule_set_id);
create index if not exists regulatory_rules_type_idx on public.regulatory_rules (rule_type);

create trigger regulatory_rules_updated_at
  before update on public.regulatory_rules
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Versioning: published snapshots of a rule set, plus change log.
-- ---------------------------------------------------------------------------
create table if not exists public.regulatory_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.regulatory_rule_sets(id) on delete cascade,
  version text not null,
  snapshot jsonb not null,     -- full rules payload at publish time
  changelog text,
  published_by uuid,
  published_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('published', 'superseded', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (rule_set_id, version)
);

create table if not exists public.regulatory_change_logs (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid references public.regulatory_rule_sets(id) on delete set null,
  rule_id uuid references public.regulatory_rules(id) on delete set null,
  change_type text not null check (change_type in (
    'created', 'updated', 'published', 'replaced', 'repealed', 'archived', 'coverage_changed'
  )),
  summary text not null,
  previous_value jsonb,
  new_value jsonb,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.rule_effectivity_periods (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid references public.regulatory_rule_sets(id) on delete cascade,
  rule_id uuid references public.regulatory_rules(id) on delete cascade,
  effective_from date not null,
  effective_to date,
  note text,
  created_at timestamptz not null default now()
);

-- Coverage per rule set and sector (e.g. PTS telecom = draft/partial).
create table if not exists public.rule_coverage_statuses (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.regulatory_rule_sets(id) on delete cascade,
  sector_code text,
  subsector_code text,
  coverage_status text not null check (coverage_status in (
    'fully_supported', 'partially_supported', 'unsupported',
    'requires_manual_review', 'pending_regulatory_guidance'
  )),
  manual_review_required boolean not null default false,
  requires_update_when_final boolean not null default false,
  note_sv text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_set_id, sector_code, subsector_code)
);

create trigger rule_coverage_statuses_updated_at
  before update on public.rule_coverage_statuses
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Regulatory tracks (parallel reporting tracks) and incident linkage.
-- ---------------------------------------------------------------------------
create table if not exists public.regulatory_tracks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_sv text not null,
  name_en text,
  description_sv text,
  authority text,
  rule_set_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Report field definitions (Cyberportalen and other report stages).
-- ---------------------------------------------------------------------------
create table if not exists public.report_field_definitions (
  id uuid primary key default gen_random_uuid(),
  report_stage text not null check (report_stage in (
    'early_warning_24h', 'incident_notification_72h', 'final_report',
    'situation_report', 'state_agency_6h', 'imy_report', 'eidas_report'
  )),
  field_key text not null,
  label_sv text not null,
  label_en text,
  copy_label text,            -- exact label used in Cyberportalen copy mode
  field_type text not null default 'text' check (field_type in (
    'text', 'textarea', 'boolean', 'datetime', 'number', 'select', 'multiselect'
  )),
  options jsonb,
  required boolean not null default true,
  validation_rule jsonb,
  help_text_sv text,
  source_rule_code text,
  legal_reference text,
  applicable_sectors text[] not null default '{}',
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_stage, field_key)
);

create trigger report_field_definitions_updated_at
  before update on public.report_field_definitions
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: rule engine content is reference data — readable by all authenticated
-- users; writable only via service role (rule admin API).
-- ---------------------------------------------------------------------------
alter table public.legal_sources enable row level security;
alter table public.legal_source_documents enable row level security;
alter table public.regulatory_rules enable row level security;
alter table public.regulatory_rule_versions enable row level security;
alter table public.regulatory_change_logs enable row level security;
alter table public.rule_effectivity_periods enable row level security;
alter table public.rule_coverage_statuses enable row level security;
alter table public.regulatory_tracks enable row level security;
alter table public.report_field_definitions enable row level security;

create policy legal_sources_select on public.legal_sources
  for select using (auth.uid() is not null);
create policy legal_source_documents_select on public.legal_source_documents
  for select using (auth.uid() is not null);
create policy regulatory_rules_select on public.regulatory_rules
  for select using (auth.uid() is not null);
create policy regulatory_rule_versions_select on public.regulatory_rule_versions
  for select using (auth.uid() is not null);
create policy regulatory_change_logs_select on public.regulatory_change_logs
  for select using (app.is_platform_admin());
create policy rule_effectivity_periods_select on public.rule_effectivity_periods
  for select using (auth.uid() is not null);
create policy rule_coverage_statuses_select on public.rule_coverage_statuses
  for select using (auth.uid() is not null);
create policy regulatory_tracks_select on public.regulatory_tracks
  for select using (auth.uid() is not null);
create policy report_field_definitions_select on public.report_field_definitions
  for select using (auth.uid() is not null);
