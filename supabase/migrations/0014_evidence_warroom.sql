-- Batch 14: evidence bank with hashes, versions, access logs, chain of
-- custody, legal holds (spec §26) and incident war rooms (spec §27).

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete set null,
  control_id uuid references public.controls(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size_bytes bigint,
  evidence_type text not null default 'other' check (evidence_type in (
    'logs', 'screenshot', 'siem_export', 'edr_alert', 'soc_report',
    'forensic_report', 'email', 'meeting_minutes', 'decision',
    'cyberportal_receipt', 'imy_receipt', 'pts_eidas_receipt',
    'vendor_statement', 'customer_communication', 'remediation_plan',
    'control_evidence', 'other'
  )),
  classification text not null default 'internal' check (classification in (
    'open', 'internal', 'confidential', 'strictly_confidential',
    'security_sensitive', 'potentially_security_classified'
  )),
  storage_path text not null,
  hash_sha256 text not null,
  version integer not null default 1,
  source text,
  chain_of_custody_notes text,
  retention_until date,
  legal_hold boolean not null default false,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists evidence_tenant_idx on public.evidence (tenant_id);
create index if not exists evidence_incident_idx on public.evidence (incident_id);

create trigger evidence_updated_at
  before update on public.evidence
  for each row execute function app.set_updated_at();

create table if not exists public.evidence_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  version integer not null,
  storage_path text not null,
  hash_sha256 text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  unique (evidence_id, version)
);

create table if not exists public.evidence_hashes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  algorithm text not null default 'sha256',
  hash_value text not null,
  computed_at timestamptz not null default now()
);

create table if not exists public.evidence_access_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  action text not null check (action in ('viewed', 'downloaded', 'uploaded', 'updated', 'deleted')),
  actor_user_id uuid,
  ip_address inet,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists evidence_access_logs_evidence_idx
  on public.evidence_access_logs (evidence_id, created_at desc);

create table if not exists public.evidence_chain_of_custody (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  event text not null,
  detail text,
  actor_user_id uuid,
  occurred_at timestamptz not null default now()
);

create table if not exists public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  reason text not null,
  incident_id uuid references public.incidents(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'released')),
  created_by uuid,
  released_by uuid,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_hold_items (
  legal_hold_id uuid not null references public.legal_holds(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  primary key (legal_hold_id, evidence_id)
);

create table if not exists public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  entity_type text not null,
  retention_days integer not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, entity_type)
);

-- Generic access/export/download logs (spec §38/§42).
create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid,
  resource_type text not null,
  resource_id uuid,
  action text not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.export_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid,
  export_type text not null,
  entity_type text,
  entity_id uuid,
  item_count integer,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table if not exists public.download_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid,
  resource_type text not null,
  resource_id uuid,
  file_name text,
  ip_address inet,
  created_at timestamptz not null default now()
);

-- Link control evidence now that the evidence table exists.
alter table public.control_evidence
  drop constraint if exists control_evidence_evidence_id_fkey;
alter table public.control_evidence
  add constraint control_evidence_evidence_id_fkey
  foreign key (evidence_id) references public.evidence(id) on delete set null;

-- War room (spec §27).
create table if not exists public.incident_war_rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed')),
  activated_by uuid,
  activated_at timestamptz not null default now(),
  closed_by uuid,
  closed_at timestamptz,
  management_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incident_id)
);

create trigger incident_war_rooms_updated_at
  before update on public.incident_war_rooms
  for each row execute function app.set_updated_at();

create table if not exists public.war_room_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  war_room_id uuid not null references public.incident_war_rooms(id) on delete cascade,
  user_id uuid,
  member_name text not null,
  role text,
  is_external boolean not null default false,
  added_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.war_room_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  war_room_id uuid not null references public.incident_war_rooms(id) on delete cascade,
  decision text not null,
  options_considered text,
  selected_option text,
  reason text not null,
  approver_name text not null,
  approver_user_id uuid,
  linked_evidence_id uuid references public.evidence(id) on delete set null,
  linked_report_id uuid references public.incident_reports(id) on delete set null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.war_room_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  war_room_id uuid not null references public.incident_war_rooms(id) on delete cascade,
  title text not null,
  assigned_to_name text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger war_room_tasks_updated_at
  before update on public.war_room_tasks
  for each row execute function app.set_updated_at();

create table if not exists public.war_room_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  war_room_id uuid not null references public.incident_war_rooms(id) on delete cascade,
  body text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

-- RLS -------------------------------------------------------------------------------
alter table public.evidence enable row level security;
alter table public.evidence_versions enable row level security;
alter table public.evidence_hashes enable row level security;
alter table public.evidence_access_logs enable row level security;
alter table public.evidence_chain_of_custody enable row level security;
alter table public.legal_holds enable row level security;
alter table public.legal_hold_items enable row level security;
alter table public.retention_policies enable row level security;
alter table public.access_logs enable row level security;
alter table public.export_logs enable row level security;
alter table public.download_logs enable row level security;
alter table public.incident_war_rooms enable row level security;
alter table public.war_room_members enable row level security;
alter table public.war_room_decisions enable row level security;
alter table public.war_room_tasks enable row level security;
alter table public.war_room_messages enable row level security;

-- Evidence metadata: tenant members read; restricted classifications require
-- privileged roles (ABAC enforced additionally in the service layer).
create policy evidence_select on public.evidence
  for select using (
    app.can_access_tenant(tenant_id)
    and (
      classification in ('open', 'internal', 'confidential')
      or app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'legal_compliance', 'dpo', 'auditor'])
    )
  );
create policy evidence_versions_select on public.evidence_versions
  for select using (app.can_access_tenant(tenant_id));
create policy evidence_hashes_select on public.evidence_hashes
  for select using (app.can_access_tenant(tenant_id));
create policy evidence_access_logs_select on public.evidence_access_logs
  for select using (app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'auditor']));
create policy evidence_chain_of_custody_select on public.evidence_chain_of_custody
  for select using (app.can_access_tenant(tenant_id));
create policy legal_holds_select on public.legal_holds
  for select using (app.can_access_tenant(tenant_id));
create policy legal_hold_items_select on public.legal_hold_items
  for select using (
    exists (
      select 1 from public.legal_holds lh
      where lh.id = legal_hold_id and app.can_access_tenant(lh.tenant_id)
    )
  );
create policy retention_policies_select on public.retention_policies
  for select using (tenant_id is null or app.can_access_tenant(tenant_id));
create policy access_logs_select on public.access_logs
  for select using (
    tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'auditor'])
  );
create policy export_logs_select on public.export_logs
  for select using (
    tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'auditor'])
  );
create policy download_logs_select on public.download_logs
  for select using (
    tenant_id is not null and app.has_tenant_role(tenant_id, array['tenant_admin', 'ciso', 'auditor'])
  );
create policy incident_war_rooms_select on public.incident_war_rooms
  for select using (app.can_access_tenant(tenant_id));
create policy war_room_members_select on public.war_room_members
  for select using (app.can_access_tenant(tenant_id));
create policy war_room_decisions_select on public.war_room_decisions
  for select using (app.can_access_tenant(tenant_id));
create policy war_room_tasks_select on public.war_room_tasks
  for select using (app.can_access_tenant(tenant_id));
create policy war_room_messages_select on public.war_room_messages
  for select using (app.can_access_tenant(tenant_id));
