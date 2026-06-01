-- Owner onboarding verification for KAN-7.
--
-- Run after migrations:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/onboarding_flow.sql
--
-- The script simulates an authenticated phone OTP user, creates an
-- organization through the public onboarding RPC, verifies owner membership,
-- resolves the active organization, and confirms the empty dashboard contract.

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

create function pg_temp.assert_true(actual boolean, label text)
returns text
language plpgsql
as $$
begin
  if actual is not true then
    raise exception '% expected true, got %', label, actual;
  end if;

  return 'pass: ' || label;
end;
$$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  'cccccccc-cccc-4ccc-cccc-cccccccccccc',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '+15555550100',
  now(),
  '{"provider":"phone","providers":["phone"]}',
  '{}',
  now(),
  now()
)
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

select pg_temp.assert_true(
  (public.get_owner_dashboard()->>'shouldOnboard')::boolean,
  'first login requires onboarding before organization creation'
);

select set_config(
  'app.test_organization_id',
  public.create_organization_with_owner('KAN-7 Test Business', 'America/Cordoba')::text,
  true
);

select pg_temp.assert_equal(
  (select count(*) from public.organization_members where organization_id = current_setting('app.test_organization_id')::uuid and user_id = auth.uid() and role = 'owner'),
  1::bigint,
  'authenticated user is inserted as owner'
);

select pg_temp.assert_equal(
  (select count(*) from public.get_my_organizations() where organization_id = current_setting('app.test_organization_id')::uuid and role = 'owner'),
  1::bigint,
  'active organization can be resolved after login'
);

select pg_temp.assert_true(
  not (public.get_owner_dashboard()->>'shouldOnboard')::boolean,
  'dashboard no longer prompts onboarding after organization creation'
);

select pg_temp.assert_equal(
  ((public.get_owner_dashboard()->'metrics'->>'contacts')::bigint),
  0::bigint,
  'empty dashboard starts with zero contacts'
);

select pg_temp.assert_equal(
  ((public.get_owner_dashboard()->'metrics'->>'openConversations')::bigint),
  0::bigint,
  'empty dashboard starts with zero open conversations'
);

rollback;
