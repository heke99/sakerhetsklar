-- Batch 16: exports/audit packages + billing/entitlements model (spec §45–46).

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  export_type text not null,
  format text,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  storage_path text,
  item_count integer,
  generated_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  package_type text not null default 'supervisory' check (package_type in (
    'supervisory', 'board', 'procurement', 'exit', 'incident', 'access_review', 'anomaly_review'
  )),
  manifest jsonb not null default '{}'::jsonb,
  storage_path text,
  generated_by uuid,
  created_at timestamptz not null default now()
);

-- Billing / plans / entitlements (spec §46) — model only; Stripe not connected.
create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_sek_monthly numeric(12, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null references public.billing_plans(code) on delete cascade,
  entitlement_key text not null,
  limit_value integer,          -- null = unlimited
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plan_code, entitlement_key)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_code text not null references public.billing_plans(code),
  status text not null default 'active' check (status in ('trial', 'active', 'past_due', 'cancelled')),
  started_at timestamptz not null default now(),
  cancelled_at timestamptz,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function app.set_updated_at();

create table if not exists public.usage_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_key text not null,
  value numeric(16, 2) not null,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS ---------------------------------------------------------------------------
alter table public.exports enable row level security;
alter table public.audit_packages enable row level security;
alter table public.billing_plans enable row level security;
alter table public.entitlements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_metrics enable row level security;
alter table public.billing_events enable row level security;

create policy exports_select on public.exports
  for select using (tenant_id is null or app.can_access_tenant(tenant_id));
create policy audit_packages_select on public.audit_packages
  for select using (app.can_access_tenant(tenant_id));
create policy billing_plans_select on public.billing_plans
  for select using (auth.uid() is not null);
create policy entitlements_select on public.entitlements
  for select using (auth.uid() is not null);
create policy subscriptions_select on public.subscriptions
  for select using (
    app.has_tenant_role(tenant_id, array['tenant_admin'])
    or app.has_platform_role(array['platform_owner', 'platform_admin', 'billing_admin'])
  );
create policy usage_metrics_select on public.usage_metrics
  for select using (
    app.has_tenant_role(tenant_id, array['tenant_admin'])
    or app.has_platform_role(array['platform_owner', 'platform_admin', 'billing_admin'])
  );
create policy billing_events_select on public.billing_events
  for select using (app.has_platform_role(array['platform_owner', 'platform_admin', 'billing_admin']));

-- Seedable plan catalog (spec §46).
insert into public.billing_plans (code, name, description)
values
  ('starter', 'Starter', '1 juridisk enhet, omfattningsbedömning, grundkontroller, incidentguide, PDF/Word-export, begränsat antal användare.'),
  ('business', 'Business', 'Flera juridiska enheter, systemregister, leverantörsregister, full rapportering, GDPR-spår, bevisbank, notifieringar, lathundar.'),
  ('enterprise', 'Enterprise', 'SSO/SAML, SCIM, flera regelspår, war room, chain of custody, integrationer, single-tenant/kundägd datamiljö, support-SLA, avancerat revisionspaket, IP-allowlist, upphandlingspaket, break-glass, åtkomstgranskning, anpassad retention.')
on conflict (code) do nothing;

insert into public.entitlements (plan_code, entitlement_key, limit_value, enabled)
values
  ('starter', 'legal_entities', 1, true),
  ('starter', 'users', 5, true),
  ('starter', 'war_room', null, false),
  ('starter', 'integrations', 0, true),
  ('business', 'legal_entities', 10, true),
  ('business', 'users', 50, true),
  ('business', 'war_room', null, false),
  ('business', 'evidence_bank', null, true),
  ('business', 'gdpr_track', null, true),
  ('enterprise', 'legal_entities', null, true),
  ('enterprise', 'users', null, true),
  ('enterprise', 'war_room', null, true),
  ('enterprise', 'sso_saml', null, true),
  ('enterprise', 'scim', null, true),
  ('enterprise', 'break_glass', null, true),
  ('enterprise', 'ip_allowlist', null, true),
  ('enterprise', 'single_tenant', null, true),
  ('enterprise', 'customer_owned_data_plane', null, true)
on conflict (plan_code, entitlement_key) do nothing;
