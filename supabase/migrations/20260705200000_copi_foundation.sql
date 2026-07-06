-- Copi foundation: feature flags, sessions, actions, reports, task extensions, dashboard sales.

alter table public.organizations
  add column if not exists feature_flags jsonb not null default jsonb_build_object(
    'copi_enabled', true,
    'copi_basic_reports', true,
    'copi_freeform_questions', true,
    'copi_pro_agent', false,
    'copi_voice', false,
    'copi_vision', false,
    'copi_custom_reports', false
  );

alter table public.owner_tasks
  drop constraint if exists owner_tasks_task_type_check;

alter table public.owner_tasks
  add constraint owner_tasks_task_type_check
  check (task_type in ('follow_up', 'manual', 'copi', 'inventory', 'callback'));

alter table public.owner_tasks
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists completed_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists owner_tasks_assignee_status_idx
on public.owner_tasks (organization_id, business_center_id, assigned_to_user_id, status, due_at);

create policy owner_tasks_insert_owners
on public.owner_tasks
for insert
to authenticated
with check (
  organization_id in (select private.user_org_ids())
  and private.is_org_owner(organization_id)
);

create table if not exists public.copi_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade
);

create index if not exists copi_sessions_org_user_idx
on public.copi_sessions (organization_id, user_id, created_at desc);

create trigger set_copi_sessions_updated_at
before update on public.copi_sessions
for each row execute function public.set_updated_at();

create table if not exists public.copi_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.copi_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner', 'assistant', 'system')),
  body text not null,
  tools_used text[] not null default '{}'::text[],
  token_usage jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists copi_messages_session_created_idx
on public.copi_messages (session_id, created_at asc);

create table if not exists public.copi_action_proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid references public.copi_sessions(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'expired', 'executed', 'failed')),
  result jsonb,
  error_message text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade
);

create index if not exists copi_action_proposals_org_status_idx
on public.copi_action_proposals (organization_id, status, created_at desc);

create table if not exists public.report_definitions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  report_key text not null,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, business_center_id, name),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade
);

create trigger set_report_definitions_updated_at
before update on public.report_definitions
for each row execute function public.set_updated_at();

alter table public.copi_sessions enable row level security;
alter table public.copi_sessions force row level security;
alter table public.copi_messages enable row level security;
alter table public.copi_messages force row level security;
alter table public.copi_action_proposals enable row level security;
alter table public.copi_action_proposals force row level security;
alter table public.report_definitions enable row level security;
alter table public.report_definitions force row level security;

create policy copi_sessions_select_members
on public.copi_sessions for select to authenticated
using (organization_id in (select private.user_org_ids()) and user_id = auth.uid());

create policy copi_sessions_insert_members
on public.copi_sessions for insert to authenticated
with check (organization_id in (select private.user_org_ids()) and user_id = auth.uid());

create policy copi_messages_select_members
on public.copi_messages for select to authenticated
using (organization_id in (select private.user_org_ids()));

create policy copi_action_proposals_select_members
on public.copi_action_proposals for select to authenticated
using (organization_id in (select private.user_org_ids()) and user_id = auth.uid());

create policy report_definitions_select_members
on public.report_definitions for select to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert on public.copi_sessions to authenticated;
grant select on public.copi_messages to authenticated;
grant select on public.copi_action_proposals to authenticated;
grant select on public.report_definitions to authenticated;
grant all on public.copi_sessions to service_role;
grant all on public.copi_messages to service_role;
grant all on public.copi_action_proposals to service_role;
grant all on public.report_definitions to service_role;

create or replace function public.get_owner_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with active_org as (
    select
      my_org.organization_id,
      my_org.name,
      my_org.role,
      organizations.vertical_id,
      organizations.feature_flags,
      default_centers.id as business_center_id,
      default_centers.name as business_center_name,
      default_centers.timezone,
      default_centers.ai_auto_send,
      default_centers.ai_follow_up_delay_hours,
      default_centers.business_hours,
      my_org.created_at
    from public.get_my_organizations() my_org
    join public.organizations
      on organizations.id = my_org.organization_id
    join public.business_centers default_centers
      on default_centers.organization_id = my_org.organization_id
     and default_centers.is_default = true
     and default_centers.is_active = true
    order by my_org.created_at asc
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
    join active_org ao
      on ao.organization_id = wc.organization_id
     and ao.business_center_id = wc.business_center_id
    limit 1
  ),
  dashboard_metrics as (
    select
      coalesce((select count(*) from public.contacts c join active_org ao on ao.organization_id = c.organization_id and ao.business_center_id = c.business_center_id), 0) as contacts,
      coalesce((select count(*) from public.conversations cv join active_org ao on ao.organization_id = cv.organization_id and ao.business_center_id = cv.business_center_id where cv.status = 'open'), 0) as open_conversations,
      coalesce((select count(*) from public.products p join active_org ao on ao.organization_id = p.organization_id where p.is_active = true), 0) as products,
      coalesce((select count(*) from public.inventory_items i join active_org ao on ao.organization_id = i.organization_id and ao.business_center_id = i.business_center_id join public.products p on p.id = i.product_id where p.is_active = true and i.quantity_on_hand <= i.reorder_threshold), 0) as low_stock_items,
      coalesce((select count(*) from public.owner_tasks t join active_org ao on ao.organization_id = t.organization_id and ao.business_center_id = t.business_center_id where t.status in ('pending', 'snoozed')), 0) as pending_follow_ups,
      coalesce((select count(*) from public.ai_drafts d join active_org ao on ao.organization_id = d.organization_id and ao.business_center_id = d.business_center_id where d.status = 'pending_approval'), 0) as pending_ai_drafts,
      coalesce((
        select count(*)
        from public.conversation_messages cm
        join active_org ao
          on ao.organization_id = cm.organization_id
         and ao.business_center_id = cm.business_center_id
        where cm.created_at >= date_trunc(
          'day',
          timezone(ao.timezone, now())
        ) at time zone ao.timezone
      ), 0) as messages_today,
      coalesce((
        select sum(round(abs(im.quantity_delta) * p.unit_price_cents))::bigint
        from public.inventory_movements im
        join active_org ao
          on ao.organization_id = im.organization_id
         and ao.business_center_id = im.business_center_id
        join public.products p
          on p.id = im.product_id
        where im.movement_type = 'sale'
          and im.created_at >= (now() - interval '7 days')
      ), 0) as weekly_sales_cents
  )
  select jsonb_build_object(
    'shouldOnboard', not exists (select 1 from active_org),
    'organization', (
      select jsonb_build_object(
        'id', organization_id,
        'name', name,
        'role', role,
        'verticalId', vertical_id,
        'timezone', timezone,
        'aiAutoSend', ai_auto_send,
        'businessHours', business_hours,
        'followUpDelayHours', ai_follow_up_delay_hours
      )
      from active_org
    ),
    'businessCenter', (
      select jsonb_build_object(
        'id', business_center_id,
        'name', business_center_name,
        'timezone', timezone,
        'aiAutoSend', ai_auto_send,
        'businessHours', business_hours,
        'followUpDelayHours', ai_follow_up_delay_hours
      )
      from active_org
    ),
    'features', coalesce((select feature_flags from active_org), '{}'::jsonb),
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
        'pendingFollowUps', pending_follow_ups,
        'pendingAiDrafts', pending_ai_drafts,
        'messagesToday', messages_today,
        'weeklySalesCents', weekly_sales_cents
      )
      from dashboard_metrics
    ),
    'emptyStates', jsonb_build_array(
      'Connect WhatsApp to start receiving customer messages.',
      'Add products to answer stock and price questions.',
      'Review AI drafts before enabling auto-send.'
    )
  )
$$;

revoke all on function public.get_owner_dashboard() from public;
revoke all on function public.get_owner_dashboard() from anon;
grant execute on function public.get_owner_dashboard() to authenticated;
