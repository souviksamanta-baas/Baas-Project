-- Identity link merge_auth_user security + same-org role merge.
--
-- Run after migrations:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/identity_link_merge.sql

begin;

create function pg_temp.assert_true(condition boolean, label text)
returns text
language plpgsql
as $$
begin
  if not condition then
    raise exception 'FAIL: %', label;
  end if;
  return 'pass: ' || label;
end;
$$;

do $$
declare
  v_keeper uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_donor uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_staff uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_org_shared uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_org_donor_only uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_keeper_member_id uuid;
  v_role text;
  v_result jsonb;
  v_denied boolean := false;
begin
  -- Minimal auth users (local tests often allow inserts into auth.users)
  insert into auth.users (id, email)
  values
    (v_keeper, 'keeper-merge@test.nexolia.local'),
    (v_donor, 'donor-merge@test.nexolia.local'),
    (v_staff, 'staff-merge@test.nexolia.local')
  on conflict (id) do nothing;

  insert into public.organizations (id, name, slug)
  values
    (v_org_shared, 'Org compartida', 'org-shared-merge-test'),
    (v_org_donor_only, 'Org solo donor', 'org-donor-merge-test')
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  values
    (v_org_shared, v_keeper, 'staff'),
    (v_org_shared, v_donor, 'owner'),
    (v_org_donor_only, v_donor, 'owner')
  on conflict do nothing;

  -- authenticated must not execute merge_auth_user
  begin
    set local role authenticated;
    perform public.merge_auth_user(v_donor, v_keeper);
  exception
    when insufficient_privilege then
      v_denied := true;
    when others then
      -- some environments raise permission denied differently
      if sqlerrm ilike '%permission%' or sqlerrm ilike '%denied%' or sqlerrm ilike '%execute%' then
        v_denied := true;
      else
        raise;
      end if;
  end;
  reset role;

  perform pg_temp.assert_true(v_denied, 'authenticated cannot execute merge_auth_user');

  -- staff block
  insert into public.nexolia_staff (user_id, role, email)
  values (v_staff, 'admin', 'staff-merge@test.nexolia.local')
  on conflict do nothing;

  begin
    perform public.merge_auth_user(v_staff, v_keeper);
    raise exception 'expected staff merge to fail';
  exception
    when others then
      perform pg_temp.assert_true(
        sqlerrm ilike '%staff%',
        'merge_auth_user blocks nexolia_staff'
      );
  end;

  -- happy path: role upgrade + move exclusive org
  select public.merge_auth_user(v_donor, v_keeper) into v_result;
  perform pg_temp.assert_true((v_result->>'ok')::boolean, 'merge_auth_user ok');

  select role into v_role
  from public.organization_members
  where organization_id = v_org_shared and user_id = v_keeper;
  perform pg_temp.assert_true(v_role = 'owner', 'same-org keeps higher role owner');

  perform pg_temp.assert_true(
    not exists (
      select 1 from public.organization_members
      where organization_id = v_org_shared and user_id = v_donor
    ),
    'donor membership removed from shared org'
  );

  perform pg_temp.assert_true(
    exists (
      select 1 from public.organization_members
      where organization_id = v_org_donor_only and user_id = v_keeper
    ),
    'donor-only org remapped to keeper'
  );

  select id into v_keeper_member_id
  from public.organization_members
  where organization_id = v_org_shared and user_id = v_keeper;
  perform pg_temp.assert_true(v_keeper_member_id is not null, 'keeper member remains');

  raise notice 'identity_link_merge.sql: all assertions passed';
end;
$$;

rollback;
