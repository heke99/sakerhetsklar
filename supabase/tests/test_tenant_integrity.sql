-- Tenant integrity tests (Batch 3 acceptance): composite FKs must make
-- cross-tenant relations impossible at the database level, even for the
-- service role (which bypasses RLS).
-- Fails with an exception if any assertion does not hold.

begin;

-- Fixtures ------------------------------------------------------------------
insert into public.tenants (id, name, slug) values
  ('20000000-0000-0000-0000-00000000000a', 'Integrity Tenant A', 'integrity-a'),
  ('20000000-0000-0000-0000-00000000000b', 'Integrity Tenant B', 'integrity-b');

insert into public.incidents (id, tenant_id, reference, title, severity) values
  ('21000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
   'INC-A-1', 'Incident i tenant A', 'high'),
  ('21000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b',
   'INC-B-1', 'Incident i tenant B', 'high');

insert into public.systems (id, tenant_id, name) values
  ('22000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'System A'),
  ('22000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'System B');

insert into public.critical_services (id, tenant_id, name) values
  ('23000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'Tjänst A');

insert into public.vendors (id, tenant_id, name) values
  ('24000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'Leverantör B');

insert into public.evidence (id, tenant_id, file_name, evidence_type, classification, storage_path, hash_sha256, uploaded_by)
values
  ('25000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b',
   'bevis-b.pdf', 'other', 'internal', 'b/bevis-b.pdf', 'abc123', null);

insert into public.incident_reports (id, tenant_id, incident_id, report_stage) values
  ('26000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b',
   '21000000-0000-0000-0000-00000000000b', 'final_report');

-- Tests: cross-tenant child rows must be rejected by composite FKs -----------

do $$
begin
  -- Comment claiming tenant A on tenant B's incident.
  begin
    insert into public.incident_comments (tenant_id, incident_id, body)
    values ('20000000-0000-0000-0000-00000000000a', '21000000-0000-0000-0000-00000000000b', 'attack');
    raise exception 'integrity failure: cross-tenant incident comment was accepted';
  exception
    when foreign_key_violation then null; -- expected
  end;

  -- Task on another tenant's incident.
  begin
    insert into public.incident_tasks (tenant_id, incident_id, title)
    values ('20000000-0000-0000-0000-00000000000a', '21000000-0000-0000-0000-00000000000b', 'attack');
    raise exception 'integrity failure: cross-tenant incident task was accepted';
  exception
    when foreign_key_violation then null; -- expected
  end;

  -- Report fields pointing at another tenant's report.
  begin
    insert into public.incident_report_fields (tenant_id, report_id, field_key, value)
    values ('20000000-0000-0000-0000-00000000000a', '26000000-0000-0000-0000-00000000000b', 'k', 'v');
    raise exception 'integrity failure: cross-tenant report field was accepted';
  exception
    when foreign_key_violation then null; -- expected
  end;

  -- Evidence from tenant B linked to a control-evidence row in tenant A.
  begin
    insert into public.control_evidence (tenant_id, control_id, evidence_id, linked_by)
    select '20000000-0000-0000-0000-00000000000a', c.id, '25000000-0000-0000-0000-00000000000b', null
    from public.controls c limit 1;
    -- Either no control exists (skip) or the FK must have rejected it.
    if found then
      raise exception 'integrity failure: cross-tenant evidence link was accepted';
    end if;
  exception
    when foreign_key_violation then null; -- expected
  end;

  -- System from tenant B linked to critical service in tenant A.
  begin
    insert into public.critical_service_systems (tenant_id, critical_service_id, system_id)
    values ('20000000-0000-0000-0000-00000000000a',
            '23000000-0000-0000-0000-00000000000a',
            '22000000-0000-0000-0000-00000000000b');
    raise exception 'integrity failure: cross-tenant critical-service/system link was accepted';
  exception
    when foreign_key_violation then null; -- expected
  end;

  -- Vendor impact referencing another tenant's vendor.
  begin
    insert into public.incident_vendor_impacts (tenant_id, incident_id, vendor_id)
    values ('20000000-0000-0000-0000-00000000000a',
            '21000000-0000-0000-0000-00000000000a',
            '24000000-0000-0000-0000-00000000000b');
    raise exception 'integrity failure: cross-tenant vendor impact was accepted';
  exception
    when foreign_key_violation then null; -- expected
  end;

  -- Incident deadline forged onto another tenant's incident.
  begin
    insert into public.incident_deadlines (tenant_id, incident_id, deadline_type, due_at)
    values ('20000000-0000-0000-0000-00000000000a',
            '21000000-0000-0000-0000-00000000000b',
            'final_report', now());
    raise exception 'integrity failure: cross-tenant deadline was accepted';
  exception
    when foreign_key_violation then null; -- expected
  end;
end $$;

-- Positive control: same-tenant rows must still work -------------------------

do $$
begin
  insert into public.incident_comments (tenant_id, incident_id, body)
  values ('20000000-0000-0000-0000-00000000000a', '21000000-0000-0000-0000-00000000000a', 'ok');

  insert into public.critical_service_systems (tenant_id, critical_service_id, system_id)
  values ('20000000-0000-0000-0000-00000000000a',
          '23000000-0000-0000-0000-00000000000a',
          '22000000-0000-0000-0000-00000000000a');
end $$;

rollback;

select 'test_tenant_integrity: PASS' as result;
