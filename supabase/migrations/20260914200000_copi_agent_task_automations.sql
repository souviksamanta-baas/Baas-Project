-- Copi Independent Agent: task recurrence/reminders, appointment remind_at,
-- custom questions, support tickets, and conversation Copi assignment.

-- ---------------------------------------------------------------------------
-- owner_tasks: reminder + recurrence + template
-- ---------------------------------------------------------------------------
alter table public.owner_tasks
  add column if not exists remind_at timestamptz,
  add column if not exists recurrence_freq text,
  add column if not exists recurrence_weekday smallint,
  add column if not exists template_key text;

alter table public.owner_tasks
  drop constraint if exists owner_tasks_recurrence_freq_check;

alter table public.owner_tasks
  add constraint owner_tasks_recurrence_freq_check
  check (
    recurrence_freq is null
    or recurrence_freq in ('daily', 'weekly', 'monthly')
  );

alter table public.owner_tasks
  drop constraint if exists owner_tasks_recurrence_weekday_check;

alter table public.owner_tasks
  add constraint owner_tasks_recurrence_weekday_check
  check (
    recurrence_weekday is null
    or (recurrence_weekday >= 0 and recurrence_weekday <= 6)
  );

create index if not exists owner_tasks_org_status_remind_at_idx
  on public.owner_tasks (organization_id, status, remind_at)
  where remind_at is not null;

create index if not exists owner_tasks_org_template_key_idx
  on public.owner_tasks (organization_id, template_key)
  where template_key is not null;

comment on column public.owner_tasks.remind_at is
  'Explicit reminder fire time; when set, schedule notifications use this instead of due_at - lead.';

comment on column public.owner_tasks.recurrence_freq is
  'When set, completing the task materializes the next instance (daily/weekly/monthly).';

comment on column public.owner_tasks.recurrence_weekday is
  'Optional weekday (0=Sun..6=Sat) for weekly recurrence next-occurrence targeting.';

comment on column public.owner_tasks.template_key is
  'Stable key for a recurrence series; defaults to the first task id when recurrence starts.';

-- ---------------------------------------------------------------------------
-- appointments: explicit reminder
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists remind_at timestamptz;

comment on column public.appointments.remind_at is
  'Explicit reminder fire time; when set, schedule notifications use this instead of starts_at - lead.';

-- ---------------------------------------------------------------------------
-- conversations: Copi assignment stamp
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists assigned_to_copi_at timestamptz,
  add column if not exists assigned_to_copi_user_id uuid references auth.users(id) on delete set null;

create index if not exists conversations_assigned_to_copi_idx
  on public.conversations (organization_id, assigned_to_copi_user_id)
  where assigned_to_copi_at is not null;

-- ---------------------------------------------------------------------------
-- copi_custom_questions (platform later)
-- ---------------------------------------------------------------------------
create table if not exists public.copi_custom_questions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_center_id uuid,
  label text not null check (length(trim(label)) > 0),
  question text not null check (length(trim(question)) > 0),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, question),
  foreign key (organization_id, business_center_id)
    references public.business_centers (organization_id, id)
    on delete cascade
);

create index if not exists copi_custom_questions_org_user_idx
  on public.copi_custom_questions (organization_id, user_id, created_at desc);

alter table public.copi_custom_questions enable row level security;
alter table public.copi_custom_questions force row level security;

drop policy if exists copi_custom_questions_select_own on public.copi_custom_questions;
create policy copi_custom_questions_select_own
on public.copi_custom_questions for select to authenticated
using (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
);

drop policy if exists copi_custom_questions_insert_own on public.copi_custom_questions;
create policy copi_custom_questions_insert_own
on public.copi_custom_questions for insert to authenticated
with check (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
);

drop policy if exists copi_custom_questions_update_own on public.copi_custom_questions;
create policy copi_custom_questions_update_own
on public.copi_custom_questions for update to authenticated
using (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
)
with check (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
);

drop policy if exists copi_custom_questions_delete_own on public.copi_custom_questions;
create policy copi_custom_questions_delete_own
on public.copi_custom_questions for delete to authenticated
using (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
);

grant select, insert, update, delete on public.copi_custom_questions to authenticated;
grant all on public.copi_custom_questions to service_role;

-- ---------------------------------------------------------------------------
-- copi_support_tickets (platform later)
-- ---------------------------------------------------------------------------
create table if not exists public.copi_support_tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_center_id uuid,
  subject text not null check (length(trim(subject)) > 0),
  body text not null check (length(trim(body)) > 0),
  severity text not null default 'normal'
    check (severity in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  session_id uuid references public.copi_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers (organization_id, id)
    on delete cascade
);

create index if not exists copi_support_tickets_org_user_idx
  on public.copi_support_tickets (organization_id, user_id, created_at desc);

create index if not exists copi_support_tickets_org_status_idx
  on public.copi_support_tickets (organization_id, status, created_at desc);

alter table public.copi_support_tickets enable row level security;
alter table public.copi_support_tickets force row level security;

drop policy if exists copi_support_tickets_select_own on public.copi_support_tickets;
create policy copi_support_tickets_select_own
on public.copi_support_tickets for select to authenticated
using (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
);

drop policy if exists copi_support_tickets_insert_own on public.copi_support_tickets;
create policy copi_support_tickets_insert_own
on public.copi_support_tickets for insert to authenticated
with check (
  organization_id in (select private.user_org_ids())
  and user_id = auth.uid()
);

grant select, insert on public.copi_support_tickets to authenticated;
grant all on public.copi_support_tickets to service_role;
