-- Phase 2 Sales AI draft replies and quote generation.
-- AI drafts are tenant-scoped and owner-reviewable; WhatsApp sends remain
-- server-side so channel tokens never reach the mobile app.

create table public.ai_drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  source_message_id uuid references public.conversation_messages(id) on delete set null,
  draft_type text not null
    check (draft_type in ('reply', 'quote')),
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected', 'sent', 'failed')),
  reply_body text not null check (length(trim(reply_body)) > 0),
  edited_body text,
  auto_send_eligible boolean not null default false,
  auto_send_attempted boolean not null default false,
  lead_status text
    check (lead_status in ('new', 'active', 'cold', 'won', 'lost')),
  catalog_context jsonb not null default '{}'::jsonb,
  decision_reason text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ai_drafts_source_message_idx
on public.ai_drafts (organization_id, source_message_id)
where source_message_id is not null;

create index ai_drafts_organization_status_idx
on public.ai_drafts (organization_id, status, created_at desc);

create index ai_drafts_conversation_idx
on public.ai_drafts (conversation_id, created_at desc);

create trigger set_ai_drafts_updated_at
before update on public.ai_drafts
for each row execute function public.set_updated_at();

create table public.ai_draft_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ai_draft_id uuid references public.ai_drafts(id) on delete cascade,
  event_type text not null
    check (event_type in ('draft_created', 'auto_send_attempted', 'auto_send_succeeded', 'auto_send_failed', 'approved', 'rejected', 'send_succeeded', 'send_failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_draft_events_draft_idx
on public.ai_draft_events (ai_draft_id, created_at);

create index ai_draft_events_organization_idx
on public.ai_draft_events (organization_id, created_at desc);

alter table public.ai_drafts enable row level security;
alter table public.ai_drafts force row level security;

alter table public.ai_draft_events enable row level security;
alter table public.ai_draft_events force row level security;

create policy ai_drafts_select_members
on public.ai_drafts
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy ai_drafts_update_members
on public.ai_drafts
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy ai_draft_events_select_members
on public.ai_draft_events
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, update on public.ai_drafts to authenticated;
grant select on public.ai_draft_events to authenticated;
grant all on public.ai_drafts to service_role;
grant all on public.ai_draft_events to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ai_drafts;
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
      coalesce((select count(*) from public.owner_tasks t join active_org ao on ao.organization_id = t.organization_id where t.status in ('pending', 'snoozed')), 0) as pending_follow_ups,
      coalesce((select count(*) from public.ai_drafts d join active_org ao on ao.organization_id = d.organization_id where d.status = 'pending_approval'), 0) as pending_ai_drafts
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
        'pendingFollowUps', pending_follow_ups,
        'pendingAiDrafts', pending_ai_drafts
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
