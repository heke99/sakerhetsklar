-- Support access gating tests (Batch 3 acceptance).

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'support@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'tenantadmin@example.test');

insert into public.tenants (id, name, slug) values
  ('20000000-0000-0000-0000-000000000001', 'Support Test Tenant', 'support-test');

insert into public.platform_admin_users (user_id, platform_role)
values ('00000000-0000-0000-0000-0000000000d1', 'support_admin');

insert into public.tenant_memberships (tenant_id, user_id)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d2');

insert into public.role_assignments (user_id, role_id, tenant_id)
select '00000000-0000-0000-0000-0000000000d2', r.id, '20000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'tenant_admin';

insert into public.legal_entities (tenant_id, name)
values ('20000000-0000-0000-0000-000000000001', 'Support Entity');

-- Before approval: support admin has no tenant data access -------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

do $$
declare n int;
begin
  select count(*) into n from public.legal_entities
  where tenant_id = '20000000-0000-0000-0000-000000000001';
  if n <> 0 then
    raise exception 'support admin sees tenant data without approved access (% rows)', n;
  end if;
end $$;

reset role;

-- Create a requested (not yet approved) support access request ---------------
insert into public.support_access_requests (id, tenant_id, requested_by, purpose, expires_at)
values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000d1',
  'Troubleshoot onboarding blocker',
  now() + interval '8 hours'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

do $$
declare n int;
begin
  select count(*) into n from public.legal_entities
  where tenant_id = '20000000-0000-0000-0000-000000000001';
  if n <> 0 then
    raise exception 'support admin sees tenant data with only REQUESTED access';
  end if;
end $$;

reset role;

-- Approve the request ---------------------------------------------------------
update public.support_access_requests
set status = 'approved',
    approved_by = '00000000-0000-0000-0000-0000000000d2',
    approved_at = now()
where id = '30000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

do $$
declare n int;
begin
  select count(*) into n from public.legal_entities
  where tenant_id = '20000000-0000-0000-0000-000000000001';
  if n <> 1 then
    raise exception 'approved support access does not grant read (% rows, expected 1)', n;
  end if;
end $$;

reset role;

-- Expired approval no longer grants access ------------------------------------
update public.support_access_requests
set expires_at = now() - interval '1 minute'
where id = '30000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

do $$
declare n int;
begin
  select count(*) into n from public.legal_entities
  where tenant_id = '20000000-0000-0000-0000-000000000001';
  if n <> 0 then
    raise exception 'expired support access still grants read';
  end if;
end $$;

reset role;

rollback;

select 'test_support_access: PASS' as result;
