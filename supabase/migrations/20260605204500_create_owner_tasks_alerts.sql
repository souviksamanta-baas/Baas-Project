-- Phase 2 follow-up tasks and owner alerts.
-- Tasks and notifications are tenant-scoped; push tokens are scoped to the
-- authenticated owner/staff user who registered the current device.

create table public.owner_tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  task_type text not null default 'follow_up'
    check (task_type in ('follow_up')),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'snoozed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  title text not null check (length(trim(title)) > 0),
  description text,
  due_at timestamptz,
  snoozed_until timestamptz,
  completed_at timestamptz,
  source_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_key)
);

create index owner_tasks_organization_status_idx
on public.owner_tasks (organization_id, status, due_at);

create index owner_tasks_contact_idx
on public.owner_tasks (contact_id);

create index owner_tasks_conversation_idx
on public.owner_tasks (conversation_id);

create trigger set_owner_tasks_updated_at
before update on public.owner_tasks
for each row execute function public.set_updated_at();

create table public.owner_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  notification_type text not null
    check (notification_type in ('low_stock')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'dismissed')),
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  source_key text not null,
  payload jsonb not null default '{}'::jsonb,
  push_sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_key)
);

create index owner_notifications_organization_status_idx
on public.owner_notifications (organization_id, status, created_at desc);

create index owner_notifications_product_idx
on public.owner_notifications (product_id);

create trigger set_owner_notifications_updated_at
before update on public.owner_notifications
for each row execute function public.set_updated_at();

create table public.owner_device_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'expo'
    check (platform in ('expo')),
  push_token text not null,
  is_active boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, push_token)
);

create index owner_device_tokens_organization_active_idx
on public.owner_device_tokens (organization_id, is_active);

create trigger set_owner_device_tokens_updated_at
before update on public.owner_device_tokens
for each row execute function public.set_updated_at();

alter table public.owner_tasks enable row level security;
alter table public.owner_tasks force row level security;

alter table public.owner_notifications enable row level security;
alter table public.owner_notifications force row level security;

alter table public.owner_device_tokens enable row level security;
alter table public.owner_device_tokens force row level security;

create policy owner_tasks_select_members
on public.owner_tasks
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy owner_tasks_update_members
on public.owner_tasks
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy owner_notifications_select_members
on public.owner_notifications
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy owner_notifications_update_members
on public.owner_notifications
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy owner_device_tokens_select_own_membership
on public.owner_device_tokens
for select
to authenticated
using (
  user_id = auth.uid()
  and organization_id in (select private.user_org_ids())
);

create policy owner_device_tokens_insert_own_membership
on public.owner_device_tokens
for insert
to authenticated
with check (
  user_id = auth.uid()
  and organization_id in (select private.user_org_ids())
);

create policy owner_device_tokens_update_own_membership
on public.owner_device_tokens
for update
to authenticated
using (
  user_id = auth.uid()
  and organization_id in (select private.user_org_ids())
)
with check (
  user_id = auth.uid()
  and organization_id in (select private.user_org_ids())
);

grant select, update on public.owner_tasks to authenticated;
grant select, update on public.owner_notifications to authenticated;
grant select, insert, update on public.owner_device_tokens to authenticated;
grant all on public.owner_tasks to service_role;
grant all on public.owner_notifications to service_role;
grant all on public.owner_device_tokens to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.owner_tasks;
    alter publication supabase_realtime add table public.owner_notifications;
  end if;
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.get_owner_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with active_org as (
    select *
    from public.get_my_organizations()
    order by created_at asc
    limit 1
  ),
  whatsapp_connection as (
    select
      wc.phone_number_id,
      wc.display_phone_number,
      wc.connection_status,
      wc.verified_at,
      wc.last_status_check_at,
      wc.last_error
    from public.whatsapp_config wc
    join active_org ao on ao.organization_id = wc.organization_id
    limit 1
  ),
  dashboard_metrics as (
    select
      coalesce((select count(*) from public.contacts c join active_org ao on ao.organization_id = c.organization_id), 0) as contacts,
      coalesce((select count(*) from public.conversations cv join active_org ao on ao.organization_id = cv.organization_id where cv.status = 'open'), 0) as open_conversations,
      coalesce((select count(*) from public.products p join active_org ao on ao.organization_id = p.organization_id where p.is_active = true), 0) as products,
      coalesce((select count(*) from public.products p join active_org ao on ao.organization_id = p.organization_id where p.is_active = true and p.stock_quantity <= p.reorder_threshold), 0) as low_stock_items,
      coalesce((select count(*) from public.owner_tasks t join active_org ao on ao.organization_id = t.organization_id where t.status in ('pending', 'snoozed')), 0) as pending_follow_ups
  )
  select jsonb_build_object(
    'shouldOnboard', not exists (select 1 from active_org),
    'organization', (
      select jsonb_build_object(
        'id', organization_id,
        'name', name,
        'role', role,
        'timezone', timezone,
        'followUpDelayHours', ai_follow_up_delay_hours
      )
      from active_org
    ),
    'whatsappConnection', coalesce(
      (
        select jsonb_build_object(
          'status', connection_status,
          'phoneNumberId', phone_number_id,
          'displayPhoneNumber', display_phone_number,
          'verifiedAt', verified_at,
          'lastStatusCheckAt', last_status_check_at,
          'lastError', last_error
        )
        from whatsapp_connection
      ),
      jsonb_build_object(
        'status', 'not_configured',
        'phoneNumberId', null,
        'displayPhoneNumber', null,
        'verifiedAt', null,
        'lastStatusCheckAt', null,
        'lastError', null
      )
    ),
    'metrics', (
      select jsonb_build_object(
        'contacts', contacts,
        'openConversations', open_conversations,
        'products', products,
        'lowStockItems', low_stock_items,
        'pendingFollowUps', pending_follow_ups
      )
      from dashboard_metrics
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
