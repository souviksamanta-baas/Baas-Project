-- Fix ambiguous get_owner_dashboard overloads from org-switch migration.
-- Having both get_owner_dashboard() and get_owner_dashboard(uuid default null)
-- made zero-arg calls fail with "function is not unique", so the app loaded
-- shouldOnboard=true and looked like the organization disappeared.

drop function if exists public.get_owner_dashboard();
drop function if exists public.get_owner_dashboard(uuid);

create or replace function public.get_owner_dashboard(p_organization_id uuid default null)
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
      ov.slug as vertical_slug,
      organizations.feature_flags,
      organizations.nav_shortcut,
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
     and organizations.archived_at is null
    join public.business_centers default_centers
      on default_centers.organization_id = my_org.organization_id
     and default_centers.is_default = true
     and default_centers.is_active = true
    left join public.organization_verticals ov
      on ov.id = organizations.vertical_id
    where p_organization_id is null
       or my_org.organization_id = p_organization_id
    order by
      case
        when p_organization_id is not null and my_org.organization_id = p_organization_id then 0
        else 1
      end,
      my_org.created_at desc
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
  instagram_connection as (
    select
      ic.page_id,
      ic.ig_user_id,
      ic.ig_username,
      ic.connection_status,
      ic.verified_at,
      ic.last_status_check_at,
      ic.last_error
    from public.instagram_config ic
    join active_org ao
      on ao.organization_id = ic.organization_id
     and ao.business_center_id = ic.business_center_id
    limit 1
  ),
  facebook_connection as (
    select
      fc.page_id,
      fc.page_name,
      fc.connection_status,
      fc.verified_at,
      fc.last_status_check_at,
      fc.last_error
    from public.facebook_config fc
    join active_org ao
      on ao.organization_id = fc.organization_id
     and ao.business_center_id = fc.business_center_id
    limit 1
  ),
  dashboard_metrics as (
    select
      coalesce((select count(*) from public.contacts c join active_org ao on ao.organization_id = c.organization_id and ao.business_center_id = c.business_center_id), 0) as contacts,
      coalesce((select count(*) from public.conversations cv join active_org ao on ao.organization_id = cv.organization_id and ao.business_center_id = cv.business_center_id where cv.status = 'open'), 0) as open_conversations,
      coalesce((select count(*) from public.products p join active_org ao on ao.organization_id = p.organization_id where p.is_active = true), 0) as products,
      coalesce((select count(*) from public.inventory_items i join active_org ao on ao.organization_id = i.organization_id and ao.business_center_id = i.business_center_id join public.products p on p.id = i.product_id where p.is_active = true and i.quantity_on_hand <= i.reorder_threshold), 0) as low_stock_items,
      coalesce((select count(*) from public.owner_tasks t join active_org ao on ao.organization_id = t.organization_id and ao.business_center_id = t.business_center_id where t.status in ('pending', 'postponed', 'snoozed')), 0) as pending_follow_ups,
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
        'verticalSlug', vertical_slug,
        'timezone', timezone,
        'navShortcut', coalesce(nav_shortcut, 'ventas'),
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
    'instagramConnection', coalesce(
      (
        select jsonb_build_object(
          'status', connection_status,
          'pageId', page_id,
          'igUserId', ig_user_id,
          'igUsername', ig_username,
          'verifiedAt', verified_at,
          'lastStatusCheckAt', last_status_check_at,
          'lastError', last_error
        )
        from instagram_connection
      ),
      jsonb_build_object(
        'status', 'not_configured',
        'pageId', null,
        'igUserId', null,
        'igUsername', null,
        'verifiedAt', null,
        'lastStatusCheckAt', null,
        'lastError', null
      )
    ),
    'facebookConnection', coalesce(
      (
        select jsonb_build_object(
          'status', connection_status,
          'pageId', page_id,
          'pageName', page_name,
          'verifiedAt', verified_at,
          'lastStatusCheckAt', last_status_check_at,
          'lastError', last_error
        )
        from facebook_connection
      ),
      jsonb_build_object(
        'status', 'not_configured',
        'pageId', null,
        'pageName', null,
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

revoke all on function public.get_owner_dashboard(uuid) from public;
revoke all on function public.get_owner_dashboard(uuid) from anon;
grant execute on function public.get_owner_dashboard(uuid) to authenticated;
