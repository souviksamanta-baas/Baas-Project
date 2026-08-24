-- KAN-401: task model replan — statuses, postpone rename, followers, reminder snooze, appointment link

-- Statuses: add in_progress; rename snoozed → postponed; keep cancelled
alter table public.owner_tasks drop constraint if exists owner_tasks_status_check;

update public.owner_tasks set status = 'postponed' where status = 'snoozed';

alter table public.owner_tasks
  add constraint owner_tasks_status_check
  check (status = any (array[
    'pending'::text,
    'in_progress'::text,
    'completed'::text,
    'cancelled'::text,
    'postponed'::text
  ]));

-- Rename snoozed_until → postponed_until (keep data)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'owner_tasks' and column_name = 'snoozed_until'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'owner_tasks' and column_name = 'postponed_until'
  ) then
    alter table public.owner_tasks rename column snoozed_until to postponed_until;
  end if;
end $$;

alter table public.owner_tasks
  add column if not exists reminder_snoozed_until timestamptz;

comment on column public.owner_tasks.reminder_snoozed_until is
  'When set, task reminder is delayed until this instant (e.g. silenciar 10 min).';

comment on column public.owner_tasks.postponed_until is
  'Target datetime for postponed tasks (Posponer hasta).';

-- Followers
create table if not exists public.owner_task_followers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.owner_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create index if not exists owner_task_followers_org_user_idx
  on public.owner_task_followers (organization_id, user_id);

create index if not exists owner_task_followers_task_idx
  on public.owner_task_followers (task_id);

alter table public.owner_task_followers enable row level security;
alter table public.owner_task_followers force row level security;

drop policy if exists owner_task_followers_select_members on public.owner_task_followers;
create policy owner_task_followers_select_members
on public.owner_task_followers for select to authenticated
using (organization_id in (select private.user_org_ids()));

drop policy if exists owner_task_followers_insert_members on public.owner_task_followers;
create policy owner_task_followers_insert_members
on public.owner_task_followers for insert to authenticated
with check (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
);

drop policy if exists owner_task_followers_delete_members on public.owner_task_followers;
create policy owner_task_followers_delete_members
on public.owner_task_followers for delete to authenticated
using (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
);

grant select, insert, delete on public.owner_task_followers to authenticated;
grant all on public.owner_task_followers to service_role;

-- Link appointments created from a task
alter table public.appointments
  add column if not exists task_id uuid references public.owner_tasks (id) on delete set null;

create index if not exists appointments_task_id_idx
  on public.appointments (task_id)
  where task_id is not null;
