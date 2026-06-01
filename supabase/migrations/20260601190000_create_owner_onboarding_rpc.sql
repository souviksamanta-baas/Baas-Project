-- Phase 0 owner onboarding RPCs for Supabase Auth users.
-- The mobile app calls these after a successful phone OTP session.

create or replace function public.create_organization_with_owner(
  org_name text,
  org_timezone text default 'UTC',
  org_business_hours jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'create_organization_with_owner requires an authenticated user';
  end if;

  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  insert into public.organizations (name, timezone, business_hours)
  values (trim(org_name), coalesce(nullif(trim(org_timezone), ''), 'UTC'), org_business_hours)
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, current_user_id, 'owner');

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text, jsonb) from public;
revoke all on function public.create_organization_with_owner(text, text, jsonb) from anon;
grant execute on function public.create_organization_with_owner(text, text, jsonb) to authenticated;

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
language sql
stable
security invoker
set search_path = public
as $$
  select
    o.id as organization_id,
    o.name,
    om.role,
    o.timezone,
    o.ai_auto_send,
    o.ai_follow_up_delay_hours,
    o.created_at
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
  order by o.created_at asc
$$;

revoke all on function public.get_my_organizations() from public;
revoke all on function public.get_my_organizations() from anon;
grant execute on function public.get_my_organizations() to authenticated;

create or replace function public.get_owner_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with active_org as (
    select *
    from public.get_my_organizations()
    order by created_at asc
    limit 1
  )
  select jsonb_build_object(
    'shouldOnboard', not exists (select 1 from active_org),
    'organization', (
      select jsonb_build_object(
        'id', organization_id,
        'name', name,
        'role', role,
        'timezone', timezone
      )
      from active_org
    ),
    'metrics', jsonb_build_object(
      'contacts', 0,
      'openConversations', 0,
      'products', 0,
      'lowStockItems', 0,
      'pendingFollowUps', 0
    ),
    'emptyStates', jsonb_build_array(
      'Connect WhatsApp to start receiving customer messages.',
      'Add products to answer stock and price questions.',
      'Create follow-up rules after the first conversations arrive.'
    )
  )
$$;

revoke all on function public.get_owner_dashboard() from public;
revoke all on function public.get_owner_dashboard() from anon;
grant execute on function public.get_owner_dashboard() to authenticated;
