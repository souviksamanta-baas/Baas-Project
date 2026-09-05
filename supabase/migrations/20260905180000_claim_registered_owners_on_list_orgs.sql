-- Claim registered_owners into organization_members when the signed-in user's
-- email matches, so Negocios / get_my_organizations shows admin-provisioned orgs.

create or replace function public.claim_my_registered_owner_orgs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_claimed integer := 0;
  r record;
  v_member_id uuid;
  v_center_id uuid;
begin
  if v_uid is null or v_email is null or v_email = '' or position('@' in v_email) = 0 then
    return 0;
  end if;

  for r in
    select ro.id, ro.organization_id, ro.user_id, ro.claimed_at
    from public.registered_owners ro
    join public.organizations o on o.id = ro.organization_id
    where lower(trim(ro.email)) = v_email
      and o.archived_at is null
  loop
    if r.user_id is distinct from v_uid then
      update public.registered_owners
      set
        user_id = v_uid,
        claimed_at = coalesce(claimed_at, now()),
        updated_at = now()
      where id = r.id;
    elsif r.claimed_at is null then
      update public.registered_owners
      set
        claimed_at = now(),
        updated_at = now()
      where id = r.id;
    end if;

    select om.id
      into v_member_id
    from public.organization_members om
    where om.organization_id = r.organization_id
      and om.user_id = v_uid
    limit 1;

    if v_member_id is null then
      insert into public.organization_members (organization_id, user_id, role)
      values (r.organization_id, v_uid, 'owner')
      returning id into v_member_id;
      v_claimed := v_claimed + 1;
    end if;

    select bc.id
      into v_center_id
    from public.business_centers bc
    where bc.organization_id = r.organization_id
      and bc.is_default = true
      and bc.is_active = true
    limit 1;

    if v_center_id is not null and v_member_id is not null then
      insert into public.business_center_members (
        business_center_id,
        organization_id,
        organization_member_id,
        role
      )
      values (v_center_id, r.organization_id, v_member_id, 'manager')
      on conflict (organization_id, business_center_id, organization_member_id)
      do nothing;
    end if;
  end loop;

  return v_claimed;
end;
$$;

revoke all on function public.claim_my_registered_owner_orgs() from public;
revoke all on function public.claim_my_registered_owner_orgs() from anon;
grant execute on function public.claim_my_registered_owner_orgs() to authenticated;
grant execute on function public.claim_my_registered_owner_orgs() to service_role;

create or replace function public.get_my_organizations()
returns table (
  organization_id uuid,
  name text,
  role text,
  timezone text,
  ai_auto_send boolean,
  ai_follow_up_delay_hours integer,
  created_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  -- Attach any pending registered_owner orgs for this email before listing.
  perform public.claim_my_registered_owner_orgs();

  return query
  select
    organizations.id as organization_id,
    organizations.name,
    organization_members.role,
    coalesce(default_centers.timezone, organizations.timezone) as timezone,
    coalesce(default_centers.ai_auto_send, organizations.ai_auto_send) as ai_auto_send,
    coalesce(
      default_centers.ai_follow_up_delay_hours,
      organizations.ai_follow_up_delay_hours
    ) as ai_follow_up_delay_hours,
    organizations.created_at
  from public.organization_members
  join public.organizations
    on organizations.id = organization_members.organization_id
  left join public.business_centers default_centers
    on default_centers.organization_id = organizations.id
   and default_centers.is_default = true
   and default_centers.is_active = true
  where organization_members.user_id = auth.uid()
    and organizations.archived_at is null
  order by organizations.created_at desc;
end;
$$;

revoke all on function public.get_my_organizations() from public;
revoke all on function public.get_my_organizations() from anon;
grant execute on function public.get_my_organizations() to authenticated;
