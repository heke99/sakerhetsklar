-- Batch 19: integrations, webhooks, API keys and SCIM structure (spec §47).

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  integration_type text not null check (integration_type in (
    'teams', 'email_intake', 'webhook', 'entra_id', 'saml', 'oidc',
    'defender', 'sentinel', 'splunk', 'elastic', 'servicenow', 'jira',
    'intune', 'azure_resource_graph', 'aws_security_hub', 'google_workspace',
    'slack', 'bankid', 'soc_portal', 'vendor_portal'
  )),
  name text not null,
  status text not null default 'inactive' check (status in (
    'active', 'inactive', 'error', 'pending_setup'
  )),
  -- Non-secret configuration only (URLs, tenant IDs, channel names).
  config jsonb not null default '{}'::jsonb,
  -- Secret references resolved server-side (env/secret manager names).
  secret_refs jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integrations_tenant_idx on public.integrations (tenant_id);

create trigger integrations_updated_at
  before update on public.integrations
  for each row execute function app.set_updated_at();

create table if not exists public.integration_error_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  error text not null,
  occurred_at timestamptz not null default now()
);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  url text not null,
  events text[] not null default '{}',
  -- Signing secret reference (env/secret manager name), never the raw secret.
  signing_secret_ref text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger webhooks_updated_at
  before update on public.webhooks
  for each row execute function app.set_updated_at();

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  response_status integer,
  created_at timestamptz not null default now()
);

create index if not exists webhook_deliveries_status_idx
  on public.webhook_deliveries (status, created_at);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key_hash text not null unique,      -- sha256 of the key; raw key shown once
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_by uuid,
  created_at timestamptz not null default now()
);

-- SCIM provisioning structure (Enterprise).
create table if not exists public.scim_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text not null unique,
  description text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.scim_provisioning_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation text not null,
  resource_type text not null,
  external_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS -----------------------------------------------------------------------------
alter table public.integrations enable row level security;
alter table public.integration_error_logs enable row level security;
alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.api_keys enable row level security;
alter table public.scim_tokens enable row level security;
alter table public.scim_provisioning_logs enable row level security;

create policy integrations_select on public.integrations
  for select using (
    app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso'])
    or app.is_platform_admin()
  );
create policy integration_error_logs_select on public.integration_error_logs
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso']));
create policy webhooks_select on public.webhooks
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin']));
create policy webhook_deliveries_select on public.webhook_deliveries
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin']));
create policy api_keys_select on public.api_keys
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin']));
create policy scim_tokens_select on public.scim_tokens
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin']));
create policy scim_provisioning_logs_select on public.scim_provisioning_logs
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin']));
