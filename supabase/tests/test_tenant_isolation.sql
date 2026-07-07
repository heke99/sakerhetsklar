-- RLS / tenant isolation tests (Batch 1 acceptance).
-- Fails with an exception if any assertion does not hold.

begin;

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'user-a@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'user-b@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'platform-admin@example.test');

insert into public.tenants (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Test Tenant A', 'test-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Test Tenant B', 'test-b');

insert into public.tenant_memberships (tenant_id, user_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1');

insert into public.role_assignments (user_id, role_id, tenant_id)
select '00000000-0000-0000-0000-0000000000a1', r.id, '10000000-0000-0000-0000-00000000000a'
from public.roles r where r.code = 'tenant_admin';

insert into public.platform_admin_users (user_id, platform_role)
values ('00000000-0000-0000-0000-0000000000c1', 'platform_admin');

insert into public.legal_entities (tenant_id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Entity A'),
  ('10000000-0000-0000-0000-00000000000b', 'Entity B');

insert into public.audit_logs (tenant_id, action, entity_type) values
  ('10000000-0000-0000-0000-00000000000a', 'test.action', 'test'),
  ('10000000-0000-0000-0000-00000000000b', 'test.action', 'test');

-- Test: user A sees only tenant A ------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

do $$
declare n int;
begin
  select count(*) into n from public.tenants;
  if n <> 1 then
    raise exception 'tenant isolation failed: user A sees % tenants, expected 1', n;
  end if;

  select count(*) into n from public.tenants where slug = 'test-b';
  if n <> 0 then
    raise exception 'tenant isolation failed: user A can see tenant B';
  end if;

  select count(*) into n from public.legal_entities;
  if n <> 1 then
    raise exception 'legal entity isolation failed: user A sees % entities, expected 1', n;
  end if;

  -- tenant_admin of A can read audit logs of A only.
  select count(*) into n from public.audit_logs;
  if n <> 1 then
    raise exception 'audit log isolation failed: user A sees % logs, expected 1', n;
  end if;
end $$;

-- Test: user B has no roles => no audit access ------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

do $$
declare n int;
begin
  select count(*) into n from public.tenants;
  if n <> 1 then
    raise exception 'tenant isolation failed: user B sees % tenants, expected 1', n;
  end if;

  select count(*) into n from public.audit_logs;
  if n <> 0 then
    raise exception 'audit log leak: user B without admin role sees % logs, expected 0', n;
  end if;
end $$;

-- Test: anonymous sees nothing ----------------------------------------------
select set_config('request.jwt.claim.sub', '', true);

do $$
declare n int;
begin
  select count(*) into n from public.tenants;
  if n <> 0 then
    raise exception 'anonymous access leak: sees % tenants, expected 0', n;
  end if;
  select count(*) into n from public.sectors;
  if n <> 0 then
    raise exception 'anonymous access leak: sees % sectors, expected 0', n;
  end if;
end $$;

-- Test: platform admin sees all tenants --------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

do $$
declare n int;
begin
  select count(*) into n from public.tenants;
  if n < 2 then
    raise exception 'platform admin should see all tenants, sees %', n;
  end if;
end $$;

-- Test: users cannot write directly (no insert policies for authenticated) ---
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

do $$
begin
  begin
    insert into public.tenants (name, slug) values ('Hacked', 'hacked');
    raise exception 'write leak: authenticated user inserted a tenant directly';
  exception
    when insufficient_privilege then null; -- expected: RLS blocks
  end;

  begin
    insert into public.audit_logs (tenant_id, action, entity_type)
    values ('10000000-0000-0000-0000-00000000000a', 'forged', 'test');
    raise exception 'write leak: authenticated user wrote an audit log directly';
  exception
    when insufficient_privilege then null; -- expected
  end;
end $$;

reset role;

rollback;

select 'test_tenant_isolation: PASS' as result;
