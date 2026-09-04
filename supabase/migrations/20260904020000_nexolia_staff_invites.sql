-- Invite-only staff access; founder already seeded in production via MCP.
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT patterns.

create table if not exists public.nexolia_staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'admin'
    check (role in ('admin', 'super_admin')),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists nexolia_staff_invites_email_uidx
  on public.nexolia_staff_invites (lower(email))
  where accepted_at is null;

create index if not exists nexolia_staff_invites_email_idx
  on public.nexolia_staff_invites (lower(email));

alter table public.nexolia_staff_invites enable row level security;
alter table public.nexolia_staff_invites force row level security;
grant all on public.nexolia_staff_invites to service_role;

-- Bootstrap founder as super_admin when the auth user already exists.
insert into public.nexolia_staff (user_id, email, display_name, role)
select u.id, lower(u.email), split_part(u.email, '@', 1), 'super_admin'
from auth.users u
where lower(u.email) = lower('souvik.samanta@gmail.com')
on conflict (user_id) do update
set
  email = excluded.email,
  role = 'super_admin',
  updated_at = now();

insert into public.nexolia_staff_invites (email, role, accepted_at, accepted_user_id)
select lower(u.email), 'super_admin', now(), u.id
from auth.users u
where lower(u.email) = lower('souvik.samanta@gmail.com')
  and not exists (
    select 1 from public.nexolia_staff_invites i
    where lower(i.email) = lower(u.email)
  );
