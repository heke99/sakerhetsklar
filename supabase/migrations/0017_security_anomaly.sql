-- Batch 17: ABAC policies, approval chains, break-glass, access reviews and
-- anomaly detection (spec §6, §38).

create table if not exists public.abac_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade, -- null = platform-wide
  name text not null,
  description text,
  effect text not null check (effect in ('allow', 'deny')),
  resource_type text not null,        -- e.g. 'evidence', 'incident', 'report'
  action text not null,               -- e.g. 'read', 'download', 'export'
  conditions jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger abac_policies_updated_at
  before update on public.abac_policies
  for each row execute function app.set_updated_at();

create table if not exists public.approval_chains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chain_key text not null,            -- e.g. 'report_approval', 'significance_decision'
  steps jsonb not null default '[]'::jsonb, -- ordered role list
  created_at timestamptz not null default now(),
  unique (tenant_id, chain_key)
);

-- Break-glass (spec §6): reason required, time-limited, logged, notifies admins.
create table if not exists public.break_glass_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid not null,
  reason text not null,
  scope text not null default 'tenant_read' check (scope in ('tenant_read', 'tenant_write', 'platform')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_by uuid,
  status text not null default 'active' check (status in ('active', 'ended', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists break_glass_sessions_status_idx
  on public.break_glass_sessions (status, expires_at);

-- Access reviews (spec §6, §45).
create table if not exists public.access_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open', 'completed')),
  started_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.access_review_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  review_id uuid not null references public.access_reviews(id) on delete cascade,
  user_id uuid,
  user_label text not null,
  roles text[] not null default '{}',
  decision text check (decision in ('keep', 'modify', 'revoke')),
  decided_by uuid,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Anomaly detection (spec §38).
create table if not exists public.security_anomaly_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title_sv text not null,
  description_sv text,
  category text not null default 'security' check (category in ('security', 'privacy')),
  params jsonb not null default '{}'::jsonb,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

create table if not exists public.security_anomaly_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  rule_code text not null references public.security_anomaly_rules(code) on delete cascade,
  actor_user_id uuid,
  severity text not null default 'warning',
  detail text,
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists security_anomaly_events_tenant_idx
  on public.security_anomaly_events (tenant_id, detected_at desc);

create table if not exists public.privacy_anomaly_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  rule_code text not null references public.security_anomaly_rules(code) on delete cascade,
  actor_user_id uuid,
  severity text not null default 'warning',
  detail text,
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.anomaly_review_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  anomaly_event_id uuid references public.security_anomaly_events(id) on delete set null,
  privacy_event_id uuid references public.privacy_anomaly_events(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'false_positive')),
  assigned_to uuid,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger anomaly_review_cases_updated_at
  before update on public.anomaly_review_cases
  for each row execute function app.set_updated_at();

-- RLS -----------------------------------------------------------------------------------
alter table public.abac_policies enable row level security;
alter table public.approval_chains enable row level security;
alter table public.break_glass_sessions enable row level security;
alter table public.access_reviews enable row level security;
alter table public.access_review_items enable row level security;
alter table public.security_anomaly_rules enable row level security;
alter table public.security_anomaly_events enable row level security;
alter table public.privacy_anomaly_events enable row level security;
alter table public.anomaly_review_cases enable row level security;

create policy abac_policies_select on public.abac_policies
  for select using (
    tenant_id is null
    or app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso'])
    or app.is_platform_admin()
  );
create policy approval_chains_select on public.approval_chains
  for select using (app.can_access_tenant(tenant_id));
create policy break_glass_sessions_select on public.break_glass_sessions
  for select using (
    (tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso']))
    or app.has_platform_role(array['platform_owner', 'security_admin', 'readonly_auditor'])
  );
create policy access_reviews_select on public.access_reviews
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'auditor']));
create policy access_review_items_select on public.access_review_items
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'auditor']));
create policy security_anomaly_rules_select on public.security_anomaly_rules
  for select using (auth.uid() is not null);
create policy security_anomaly_events_select on public.security_anomaly_events
  for select using (
    (tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso']))
    or app.has_platform_role(array['platform_owner', 'security_admin', 'readonly_auditor'])
  );
create policy privacy_anomaly_events_select on public.privacy_anomaly_events
  for select using (
    (tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'dpo']))
    or app.has_platform_role(array['platform_owner', 'security_admin', 'readonly_auditor'])
  );
create policy anomaly_review_cases_select on public.anomaly_review_cases
  for select using (
    (tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'dpo']))
    or app.has_platform_role(array['platform_owner', 'security_admin', 'readonly_auditor'])
  );

-- Seed anomaly rules (spec §38).
insert into public.security_anomaly_rules (code, title_sv, description_sv, category, params, severity)
values
  ('unusual_evidence_views', 'Ovanligt många bevisvisningar', 'En användare har visat/nedladdat ovanligt många bevis under kort tid.', 'security', '{"threshold": 30, "window_hours": 24}', 'warning'),
  ('repeated_restricted_access', 'Upprepad åtkomst till begränsade bevis', 'Upprepade åtkomster till begränsade bevis av samma användare.', 'security', '{"threshold": 5, "window_hours": 24}', 'critical'),
  ('large_export_attempts', 'Stora exportförsök', 'Ovanligt många exporter under kort tid.', 'security', '{"threshold": 10, "window_hours": 24}', 'warning'),
  ('mass_downloads', 'Massnedladdning', 'Många nedladdningar av samma användare under kort tid.', 'security', '{"threshold": 20, "window_hours": 24}', 'critical'),
  ('after_hours_access', 'Åtkomst utanför kontorstid', 'Åtkomst till begränsade resurser nattetid (22–06).', 'privacy', '{"start_hour": 22, "end_hour": 6, "threshold": 5}', 'info'),
  ('repeated_role_changes', 'Upprepade rolländringar', 'Många rolländringar under kort tid.', 'security', '{"threshold": 5, "window_hours": 24}', 'warning'),
  ('break_glass_misuse', 'Break-glass-avvikelse', 'Break-glass-session utan avslut eller upprepade sessioner.', 'security', '{"threshold": 2, "window_hours": 72}', 'critical'),
  ('suspicious_submission_changes', 'Misstänkta ändringar av inskickningsstatus', 'Många ändringar av Cyberportalen-inskickningsstatus.', 'security', '{"threshold": 5, "window_hours": 24}', 'warning'),
  ('unusual_deletions', 'Ovanlig raderings-/arkiveringsaktivitet', 'Många raderingar/arkiveringar under kort tid.', 'security', '{"threshold": 10, "window_hours": 24}', 'warning')
on conflict (code) do nothing;
