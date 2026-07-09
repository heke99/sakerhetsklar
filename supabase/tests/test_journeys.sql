-- End-to-end journey tests (batch 21). Simulates the core customer/admin
-- journeys at the database layer: service-role writes (as the app's service
-- layer performs them, in the same order) + RLS-verified reads as the actual
-- users. Fails with an exception if any assertion does not hold.

begin;

-- ============================================================================
-- Journey 1: Platform admin creates tenant, assigns plan, invites first admin;
--            the admin accepts and gains access.
-- ============================================================================

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-0000000000f1', 'journey-platform@example.test'),
  ('30000000-0000-0000-0000-0000000000a1', 'journey-admin@example.test'),
  ('30000000-0000-0000-0000-0000000000b1', 'journey-outsider@example.test');

insert into public.platform_admin_users (user_id, platform_role)
values ('30000000-0000-0000-0000-0000000000f1', 'platform_admin');

insert into public.tenants (id, name, slug, plan, created_by) values
  ('31000000-0000-0000-0000-000000000001', 'Journey Kommun', 'journey-kommun',
   'business', '30000000-0000-0000-0000-0000000000f1');
insert into public.tenant_settings (tenant_id)
values ('31000000-0000-0000-0000-000000000001');

-- Second tenant for isolation assertions.
insert into public.tenants (id, name, slug) values
  ('31000000-0000-0000-0000-000000000002', 'Journey Other', 'journey-other');

-- Invitation with hashed token (raw token never stored).
insert into public.tenant_invitations (id, tenant_id, email, role_code, token_hash, expires_at, invited_by)
values ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
        'journey-admin@example.test', 'tenant_admin',
        encode(sha256('journey-raw-token'::bytea), 'hex'),
        now() + interval '7 days', '30000000-0000-0000-0000-0000000000f1');

-- Accept: membership + role assignment + invitation marked accepted.
insert into public.tenant_memberships (tenant_id, user_id)
values ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000a1');
insert into public.role_assignments (user_id, role_id, tenant_id)
select '30000000-0000-0000-0000-0000000000a1', r.id, '31000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'tenant_admin';
update public.tenant_invitations
set status = 'accepted', accepted_by = '30000000-0000-0000-0000-0000000000a1', accepted_at = now()
where id = '32000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-0000000000a1', true);

do $$
declare n int;
begin
  select count(*) into n from public.tenants where id = '31000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'journey1: accepted admin cannot see the tenant'; end if;

  select count(*) into n from public.tenants where id = '31000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'journey1: admin sees a foreign tenant'; end if;
end $$;

reset role;

-- ============================================================================
-- Journey 2: Operational — critical service, system, vendor, links, risk,
--            control, evidence.
-- ============================================================================

insert into public.vendors (id, tenant_id, name)
values ('33000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Journey Leverantör AB');

insert into public.systems (id, tenant_id, name, vendor_id)
values ('33000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001',
        'Journey Ekonomisystem', '33000000-0000-0000-0000-000000000001');

insert into public.critical_services (id, tenant_id, name)
values ('33000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001', 'Journey Medborgarportal');

insert into public.critical_service_systems (tenant_id, critical_service_id, system_id)
values ('31000000-0000-0000-0000-000000000001',
        '33000000-0000-0000-0000-000000000003',
        '33000000-0000-0000-0000-000000000002');

insert into public.risks (id, tenant_id, title, likelihood, impact, risk_level, linked_system_id)
values ('33000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000001',
        'Journey-risk: beroende av enskild leverantör', 3, 4, 'high',
        '33000000-0000-0000-0000-000000000002');

insert into public.controls (id, tenant_id, code, title_sv, status)
values ('33000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000001',
        'JRN-01', 'Journey-kontroll', 'in_progress');

insert into public.evidence (id, tenant_id, control_id, file_name, evidence_type, classification, storage_path, hash_sha256)
values ('33000000-0000-0000-0000-000000000006', '31000000-0000-0000-0000-000000000001',
        '33000000-0000-0000-0000-000000000005', 'journey-policy.pdf', 'decision', 'internal',
        '31000000-0000-0000-0000-000000000001/journey-policy.pdf', 'deadbeef');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-0000000000a1', true);

do $$
declare n int;
begin
  select count(*) into n from public.critical_service_systems
    where tenant_id = '31000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'journey2: service/system link not visible to member'; end if;

  select count(*) into n from public.evidence
    where tenant_id = '31000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'journey2: evidence not visible to member'; end if;
end $$;

-- Outsider sees nothing of the operational registers.
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-0000000000b1', true);
do $$
declare n int;
begin
  select count(*) into n from public.systems where tenant_id = '31000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'journey2: outsider sees systems'; end if;
  select count(*) into n from public.evidence;
  if n <> 0 then raise exception 'journey2: outsider sees evidence'; end if;
end $$;

reset role;

-- ============================================================================
-- Journey 3: Incident — incident, impacts, significance, deadline, report,
--            approval, submission with reference, deadline met, audit trail.
-- ============================================================================

insert into public.incidents (id, tenant_id, reference, title, severity, identified_as_significant_at)
values ('34000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
        'INC-J-1', 'Journey-incident: portal otillgänglig', 'high', now());

insert into public.incident_system_impacts (tenant_id, incident_id, system_id)
values ('31000000-0000-0000-0000-000000000001',
        '34000000-0000-0000-0000-000000000001',
        '33000000-0000-0000-0000-000000000002');

insert into public.incident_significance_assessments
  (id, tenant_id, incident_id, facts, recommendation, confidence)
values ('34000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001',
        '34000000-0000-0000-0000-000000000001', '{"severity":"high"}', 'significant_reportable', 'high');

insert into public.incident_deadlines (id, tenant_id, incident_id, deadline_type, due_at, status)
values ('34000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001',
        '34000000-0000-0000-0000-000000000001', 'incident_notification', now() + interval '72 hours', 'pending');

insert into public.incident_reports (id, tenant_id, incident_id, report_stage, status, approved_by, approved_at)
values ('34000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000001',
        '34000000-0000-0000-0000-000000000001', 'incident_notification_72h', 'approved',
        '30000000-0000-0000-0000-0000000000a1', now());

-- Submission with stage-specific reference; deadline met as a consequence.
insert into public.incident_report_submissions (tenant_id, report_id, submitted_by, method, reference)
values ('31000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000004',
        '30000000-0000-0000-0000-0000000000a1', 'cyberportalen', 'CP-2026-77001');

insert into public.cyberportal_incident_ids (tenant_id, incident_id, report_id, report_stage, cyberportal_id)
values ('31000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001',
        '34000000-0000-0000-0000-000000000004', 'incident_notification_72h', 'CP-2026-77001');

update public.incident_deadlines set status = 'met', met_at = now()
where id = '34000000-0000-0000-0000-000000000003';

insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000a1',
   'incident.created', 'incident', '34000000-0000-0000-0000-000000000001'),
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000a1',
   'report.approved', 'incident_report', '34000000-0000-0000-0000-000000000004'),
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000a1',
   'report.marked_submitted', 'incident_report', '34000000-0000-0000-0000-000000000004');

do $$
declare n int;
begin
  -- The audit trail for the incident journey is complete.
  select count(*) into n from public.audit_logs
    where tenant_id = '31000000-0000-0000-0000-000000000001'
      and action in ('incident.created', 'report.approved', 'report.marked_submitted');
  if n <> 3 then raise exception 'journey3: audit trail incomplete (%)', n; end if;

  -- The deadline is met and the submission carries the reference.
  select count(*) into n from public.incident_deadlines
    where id = '34000000-0000-0000-0000-000000000003' and status = 'met';
  if n <> 1 then raise exception 'journey3: deadline not met'; end if;

  select count(*) into n from public.incident_report_submissions
    where report_id = '34000000-0000-0000-0000-000000000004' and reference = 'CP-2026-77001';
  if n <> 1 then raise exception 'journey3: submission reference missing'; end if;
end $$;

-- Cross-tenant sabotage attempts must be impossible (composite FKs).
do $$
begin
  begin
    insert into public.incident_reports (tenant_id, incident_id, report_stage)
    values ('31000000-0000-0000-0000-000000000002',
            '34000000-0000-0000-0000-000000000001', 'final_report');
    raise exception 'journey3: cross-tenant report accepted';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Member of the tenant sees the full incident chain via RLS.
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-0000000000a1', true);
do $$
declare n int;
begin
  select count(*) into n from public.incident_reports
    where incident_id = '34000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'journey3: member cannot read the report'; end if;
end $$;

-- Outsider sees none of it.
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-0000000000b1', true);
do $$
declare n int;
begin
  select count(*) into n from public.incidents where reference = 'INC-J-1';
  if n <> 0 then raise exception 'journey3: outsider sees the incident'; end if;

  -- Outsider cannot forge writes either (no write policies for authenticated).
  begin
    insert into public.incident_comments (tenant_id, incident_id, body)
    values ('31000000-0000-0000-0000-000000000001',
            '34000000-0000-0000-0000-000000000001', 'sabotage');
    raise exception 'journey3: outsider wrote a comment';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

rollback;

select 'test_journeys: PASS' as result;
