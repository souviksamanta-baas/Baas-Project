-- Phase 0 tenant foundation.
-- Creates the organization membership model and RLS policies used by the MVP.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'UTC',
  ai_auto_send boolean not null default false,
  ai_follow_up_delay_hours integer not null default 24 check (ai_follow_up_delay_hours >= 0),
  business_hours jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table public.organization_members (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_id_idx
on public.organization_members (user_id);

create index organization_members_organization_id_idx
on public.organization_members (organization_id);

create table public.whatsapp_config (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_number_id text not null,
  waba_id text,
  access_token_encrypted text,
  webhook_verify_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id),
  unique (phone_number_id)
);

create trigger set_whatsapp_config_updated_at
before update on public.whatsapp_config
for each row execute function public.set_updated_at();

create or replace function public.user_org_ids()
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

create or replace function public.is_org_owner(target_organization_id uuid)
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
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'create_organization_with_owner requires an authenticated user';
  end if;

  insert into public.organizations (name, timezone, business_hours)
  values (org_name, coalesce(nullif(org_timezone, ''), 'UTC'), org_business_hours)
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');

  return new_organization_id;
end;
$$;

revoke all on function public.user_org_ids() from public;
revoke all on function public.is_org_owner(uuid) from public;
revoke all on function public.create_organization_with_owner(text, text, jsonb) from public;

grant execute on function public.user_org_ids() to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.create_organization_with_owner(text, text, jsonb) to authenticated;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;

alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;

alter table public.whatsapp_config enable row level security;
alter table public.whatsapp_config force row level security;

create policy organizations_select_members
on public.organizations
for select
to authenticated
using (id in (select public.user_org_ids()));

create policy organizations_update_owners
on public.organizations
for update
to authenticated
using (public.is_org_owner(id))
with check (public.is_org_owner(id));

create policy organization_members_select_members
on public.organization_members
for select
to authenticated
using (organization_id in (select public.user_org_ids()));

create policy organization_members_insert_owners
on public.organization_members
for insert
to authenticated
with check (public.is_org_owner(organization_id));

create policy organization_members_update_owners
on public.organization_members
for update
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create policy organization_members_delete_owners
on public.organization_members
for delete
to authenticated
using (public.is_org_owner(organization_id));

grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant usage on schema public to authenticated;

revoke all on public.whatsapp_config from anon, authenticated;
grant all on public.whatsapp_config to service_role;
