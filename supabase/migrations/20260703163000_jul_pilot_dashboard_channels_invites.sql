-- Jul 2026 pilot: multi-channel inbox, dashboard metrics, multi-branch staff invites.

alter table public.conversations
  drop constraint if exists conversations_channel_check;

alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('whatsapp', 'instagram', 'facebook', 'email'));

alter table public.organization_invites
  add column if not exists invited_business_center_ids uuid[] not null default '{}'::uuid[];

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
      0::bigint as weekly_sales_cents
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
