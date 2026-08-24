-- Distinguish co_owner vs manager at organization_members level.
-- Invite "Co-dueño" / "Administrador" / "Empleado" map to org roles co_owner / manager / staff.

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role = any (array['owner'::text, 'co_owner'::text, 'manager'::text, 'staff'::text]));

alter table public.organization_invites
  drop constraint if exists organization_invites_org_role_check;

alter table public.organization_invites
  add constraint organization_invites_org_role_check
  check (org_role = any (array['owner'::text, 'co_owner'::text, 'manager'::text, 'staff'::text]));

-- Co-dueño gets the same RLS write powers as dueño for org settings / integrations.
create or replace function private.is_org_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and role in ('owner', 'co_owner')
  )
$$;

-- Surface stored org role (no longer collapse center manager into "manager" for staff).
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
  order by organizations.created_at desc
$$;

revoke all on function public.get_my_organizations() from public;
revoke all on function public.get_my_organizations() from anon;
grant execute on function public.get_my_organizations() to authenticated;

-- Backfill: staff + center manager used to mean both Administrador and Co-dueño.
-- Known co-dueño invite (JP Vélez) first; remaining staff+manager → manager.
update public.organization_members om
set role = 'co_owner'
from auth.users u
where om.user_id = u.id
  and om.role = 'staff'
  and regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') = '5493518354874'
  and exists (
    select 1
    from public.business_center_members bcm
    where bcm.organization_member_id = om.id
      and bcm.role = 'manager'
  );

update public.organization_members om
set role = 'manager'
where om.role = 'staff'
  and exists (
    select 1
    from public.business_center_members bcm
    where bcm.organization_member_id = om.id
      and bcm.role = 'manager'
  );
