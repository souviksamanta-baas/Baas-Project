-- Harden helper functions created for tenant RLS.
-- Keep policy helpers out of the exposed public API schema and leave
-- organization onboarding to the dedicated onboarding story.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

create or replace function private.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
$$;

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
      and role = 'owner'
  )
$$;

revoke all on function private.user_org_ids() from public;
revoke all on function private.user_org_ids() from anon;
revoke all on function private.is_org_owner(uuid) from public;
revoke all on function private.is_org_owner(uuid) from anon;

grant execute on function private.user_org_ids() to authenticated;
grant execute on function private.is_org_owner(uuid) to authenticated;

drop policy if exists organizations_select_members on public.organizations;
drop policy if exists organizations_update_owners on public.organizations;
drop policy if exists organization_members_select_members on public.organization_members;
drop policy if exists organization_members_insert_owners on public.organization_members;
drop policy if exists organization_members_update_owners on public.organization_members;
drop policy if exists organization_members_delete_owners on public.organization_members;

create policy organizations_select_members
on public.organizations
for select
to authenticated
using (id in (select private.user_org_ids()));

create policy organizations_update_owners
on public.organizations
for update
to authenticated
using (private.is_org_owner(id))
with check (private.is_org_owner(id));

create policy organization_members_select_members
on public.organization_members
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy organization_members_insert_owners
on public.organization_members
for insert
to authenticated
with check (private.is_org_owner(organization_id));

create policy organization_members_update_owners
on public.organization_members
for update
to authenticated
using (private.is_org_owner(organization_id))
with check (private.is_org_owner(organization_id));

create policy organization_members_delete_owners
on public.organization_members
for delete
to authenticated
using (private.is_org_owner(organization_id));

drop function if exists public.user_org_ids();
drop function if exists public.is_org_owner(uuid);
drop function if exists public.create_organization_with_owner(text, text, jsonb);
