-- Expand owner_notifications catalog + per-user notification preferences.

-- Target user (null = org/admin broadcast resolved at send time)
alter table public.owner_notifications
  add column if not exists target_user_id uuid references auth.users(id) on delete set null;

alter table public.owner_notifications
  add column if not exists channel text not null default 'tareas';

-- Drop narrow type check and allow catalog IDs (+ legacy low_stock)
alter table public.owner_notifications
  drop constraint if exists owner_notifications_notification_type_check;

alter table public.owner_notifications
  add constraint owner_notifications_notification_type_check
  check (
    notification_type in (
      'low_stock',
      'stock.low',
      'digest.daily',
      'digest.weekly',
      'task.assigned',
      'task.reminder',
      'task.overdue',
      'task.snooze_wake',
      'appointment.reminder',
      'appointment.assigned',
      'appointment.starting',
      'inbox.new_message',
      'inbox.unanswered',
      'sales.completed',
      'payment.received',
      'payment.failed',
      'stock.movement',
      'quote.accepted',
      'invoice.overdue',
      'copi.action_needed',
      'team.invite_accepted'
    )
  );

alter table public.owner_notifications
  drop constraint if exists owner_notifications_channel_check;

alter table public.owner_notifications
  add constraint owner_notifications_channel_check
  check (channel in ('tareas', 'inbox', 'stock', 'ventas', 'pagos'));

create index if not exists owner_notifications_target_user_idx
  on public.owner_notifications (organization_id, target_user_id, created_at desc)
  where target_user_id is not null;

create index if not exists owner_notifications_type_created_idx
  on public.owner_notifications (organization_id, notification_type, created_at desc);

-- Normalize legacy type to catalog id (keep low_stock accepted for reads)
update public.owner_notifications
set notification_type = 'stock.low', channel = 'stock'
where notification_type = 'low_stock';

-- Per-user prefs (reminder lead time + enable map)
create table if not exists public.user_notification_prefs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_lead_minutes integer not null default 30
    check (reminder_lead_minutes in (15, 30, 60)),
  enabled jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create trigger set_user_notification_prefs_updated_at
before update on public.user_notification_prefs
for each row execute function public.set_updated_at();

alter table public.user_notification_prefs enable row level security;
alter table public.user_notification_prefs force row level security;

create policy user_notification_prefs_select_own
on public.user_notification_prefs for select to authenticated
using (
  user_id = auth.uid()
  and organization_id in (select private.user_org_ids())
);

create policy user_notification_prefs_insert_own
on public.user_notification_prefs for insert to authenticated
with check (
  user_id = auth.uid()
  and organization_id in (select private.user_org_ids())
);

create policy user_notification_prefs_update_own
on public.user_notification_prefs for update to authenticated
using (
  user_id = auth.uid()
  and organization_id in (select private.user_org_ids())
)
with check (
  user_id = auth.uid()
  and organization_id in (select private.user_org_ids())
);

grant select, insert, update on public.user_notification_prefs to authenticated;
grant all on public.user_notification_prefs to service_role;
