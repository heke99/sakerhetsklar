create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_number text,
  deployment_model text not null default 'multi_tenant',
  status text not null default 'active',
  onboarding_status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  organization_number text,
  country_code text not null default 'SE',
  entity_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regulatory_rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  jurisdiction text not null default 'SE',
  status text not null default 'active',
  effective_from date,
  effective_to date,
  version text not null default '1.0.0',
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sectors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_sv text not null,
  name_en text,
  annex text,
  default_supervisory_authority text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;
alter table public.legal_entities enable row level security;
alter table public.regulatory_rule_sets enable row level security;
alter table public.sectors enable row level security;
alter table public.audit_logs enable row level security;
