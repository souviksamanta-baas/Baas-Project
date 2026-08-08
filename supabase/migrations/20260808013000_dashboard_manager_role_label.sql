-- Surface center-level manager as organization.role = 'manager' for dashboard/UI.
-- Invite "Administrador" is stored as org staff + center manager; UI previously always showed Equipo.

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
    organizations.id as organization_id,
    organizations.name,
    case
      when organization_members.role = 'owner' then 'owner'
      when exists (
        select 1
        from public.business_center_members bcm
        where bcm.organization_member_id = organization_members.id
          and bcm.role = 'manager'
      ) then 'manager'
      else organization_members.role
    end as role,
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
  order by organizations.created_at desc
$$;

revoke all on function public.get_my_organizations() from public;
revoke all on function public.get_my_organizations() from anon;
grant execute on function public.get_my_organizations() to authenticated;
