-- Per-user read receipts for owner_notifications.
-- Keeps notification history (dismiss still archives); mark-read does not delete.

create table if not exists public.owner_notification_reads (
  notification_id uuid not null references public.owner_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists owner_notification_reads_user_idx
  on public.owner_notification_reads (user_id, read_at desc);

alter table public.owner_notification_reads enable row level security;
alter table public.owner_notification_reads force row level security;

create policy owner_notification_reads_select_own
on public.owner_notification_reads
for select
to authenticated
using (user_id = auth.uid());

create policy owner_notification_reads_insert_own
on public.owner_notification_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.owner_notifications n
    where n.id = notification_id
      and n.organization_id in (select private.user_org_ids())
      and (n.target_user_id is null or n.target_user_id = auth.uid())
  )
);

create policy owner_notification_reads_update_own
on public.owner_notification_reads
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy owner_notification_reads_delete_own
on public.owner_notification_reads
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.owner_notification_reads to authenticated;
grant all on public.owner_notification_reads to service_role;
