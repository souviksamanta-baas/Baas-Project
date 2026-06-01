-- Cross-tenant RLS verification for KAN-6.
--
-- Run against a local Supabase database after migrations:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_cross_tenant.sql
--
-- The script creates two test users and two organizations in a transaction,
-- switches into the authenticated role for each user, and asserts that each
-- user can only read their own tenant rows.

begin;

create function pg_temp.assert_equal(actual bigint, expected bigint, label text)
returns text
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception '% expected %, got %', label, expected, actual;
  end if;

  return 'pass: ' || label;
end;
$$;

create function pg_temp.assert_membership_insert_denied(target_org_id uuid, target_user_id uuid, label text)
returns text
language plpgsql
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (target_org_id, target_user_id, 'staff');

  raise exception '% expected insert to be denied', label;
exception
  when insufficient_privilege or with_check_option_violation then
    return 'pass: ' || label;
end;
$$;

create function pg_temp.assert_whatsapp_config_select_denied(label text)
returns text
language plpgsql
as $$
declare
  row_count bigint;
begin
  select count(*) into row_count from public.whatsapp_config;

  raise exception '% expected select to be denied, got % rows', label, row_count;
exception
  when insufficient_privilege then
    return 'pass: ' || label;
end;
$$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tenant-a@example.test',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOHI7SKq9S9B9fJtLkq5YVpiAb3p5n6eW',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tenant-b@example.test',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOHI7SKq9S9B9fJtLkq5YVpiAb3p5n6eW',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.organizations (id, name)
values
  ('11111111-1111-4111-8111-111111111111', 'Tenant A'),
  ('22222222-2222-4222-8222-222222222222', 'Tenant B');

insert into public.organization_members (organization_id, user_id, role)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'owner');

insert into public.whatsapp_config (organization_id, phone_number_id, waba_id)
values
  ('11111111-1111-4111-8111-111111111111', 'phone-number-a', 'waba-a'),
  ('22222222-2222-4222-8222-222222222222', 'phone-number-b', 'waba-b');

set local role authenticated;

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
select pg_temp.assert_equal((select count(*) from public.organizations), 1::bigint, 'user A sees one organization');
select pg_temp.assert_equal((select count(*) from public.organizations where name = 'Tenant A'), 1::bigint, 'user A sees Tenant A');
select pg_temp.assert_equal((select count(*) from public.organizations where name = 'Tenant B'), 0::bigint, 'user A cannot see Tenant B');
select pg_temp.assert_equal((select count(*) from public.organization_members), 1::bigint, 'user A sees one membership');
select pg_temp.assert_whatsapp_config_select_denied('user A cannot read whatsapp_config');
select pg_temp.assert_membership_insert_denied('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'user A cannot write membership rows for Tenant B');

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
select pg_temp.assert_equal((select count(*) from public.organizations), 1::bigint, 'user B sees one organization');
select pg_temp.assert_equal((select count(*) from public.organizations where name = 'Tenant B'), 1::bigint, 'user B sees Tenant B');
select pg_temp.assert_equal((select count(*) from public.organizations where name = 'Tenant A'), 0::bigint, 'user B cannot see Tenant A');
select pg_temp.assert_equal((select count(*) from public.organization_members), 1::bigint, 'user B sees one membership');
select pg_temp.assert_whatsapp_config_select_denied('user B cannot read whatsapp_config');

rollback;
