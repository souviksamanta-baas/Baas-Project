-- All-sector features: verticals seed, expanded feature_flags defaults,
-- create-org accepts vertical + flags, appointments, facebook_config + dashboard.

-- ---------------------------------------------------------------------------
-- Verticals
-- ---------------------------------------------------------------------------
alter table public.organization_verticals
  add column if not exists suggested_feature_flags jsonb not null default '{}'::jsonb;

insert into public.organization_verticals (slug, display_name, description, sort_order, suggested_feature_flags)
values
  (
    'kiosco',
    'Kiosco',
    'Comercio de cercanía con stock y ventas.',
    10,
    jsonb_build_object(
      'appointments', false,
      'commerce_inventory', true,
      'commerce_lots', true,
      'commerce_nav_shortcut', true,
      'commerce_pos', true,
      'commerce_purchases', true,
      'commerce_suppliers', true
    )
  ),
  (
    'dietetica',
    'Dietética',
    'Negocio de productos naturales con stock y lotes.',
    20,
    jsonb_build_object(
      'appointments', false,
      'commerce_inventory', true,
      'commerce_lots', true,
      'commerce_nav_shortcut', true,
      'commerce_pos', true,
      'commerce_purchases', true,
      'commerce_suppliers', true
    )
  ),
  (
    'servicios_profesionales',
    'Servicios profesionales',
    'Servicios con agenda, chats y facturación.',
    30,
    jsonb_build_object(
      'appointments', true,
      'commerce_inventory', false,
      'commerce_lots', false,
      'commerce_nav_shortcut', false,
      'commerce_pos', false,
      'commerce_purchases', false,
      'commerce_suppliers', false
    )
  )
on conflict (slug) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  suggested_feature_flags = excluded.suggested_feature_flags,
  is_active = true,
  updated_at = now();

-- Backfill existing orgs → kiosco; keep feature_flags unchanged
update public.organizations
set vertical_id = (
  select id from public.organization_verticals where slug = 'kiosco' limit 1
)
where vertical_id is null;

-- ---------------------------------------------------------------------------
-- Feature flags column default (new keys; existing org JSON left as-is)
-- ---------------------------------------------------------------------------
alter table public.organizations
  alter column feature_flags set default jsonb_build_object(
    'account', true,
    'appointments', false,
    'billing_arca', true,
    'billing_cash', false,
    'billing_invoices', true,
    'billing_quotes', true,
    'browser_session', true,
    'commerce_inventory', true,
    'commerce_lots', true,
    'commerce_nav_shortcut', true,
    'commerce_pos', true,
    'commerce_purchases', true,
    'commerce_suppliers', true,
    'copi_basic_reports', true,
    'copi_custom_reports', false,
    'copi_enabled', true,
    'copi_freeform_questions', true,
    'copi_pro_agent', false,
    'copi_vision', false,
    'copi_voice', false,
    'help_privacy', true,
    'inbox', true,
    'integrations', true,
    'integrations_email', true,
    'integrations_instagram', true,
    'integrations_messenger', true,
    'integrations_sms', true,
    'integrations_whatsapp', true,
    'multi_sucursales', false,
    'notifications', true,
    'tasks', true
  );

-- ---------------------------------------------------------------------------
-- create_organization_with_owner: vertical + feature_flags
-- ---------------------------------------------------------------------------
drop function if exists public.create_organization_with_owner(text, text, jsonb);

create or replace function public.create_organization_with_owner(
  org_name text,
  org_timezone text default 'UTC',
  org_business_hours jsonb default null,
  org_vertical_id uuid default null,
  org_feature_flags jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_organization_id uuid;
  new_member_id uuid;
  new_business_center_id uuid;
begin
  if current_user_id is null then
    raise exception 'create_organization_with_owner requires an authenticated user';
  end if;

  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  if org_feature_flags is null then
    insert into public.organizations (name, timezone, business_hours, vertical_id)
    values (
      trim(org_name),
      coalesce(nullif(trim(org_timezone), ''), 'UTC'),
      org_business_hours,
      org_vertical_id
    )
    returning id into new_organization_id;
  else
    insert into public.organizations (name, timezone, business_hours, vertical_id, feature_flags)
    values (
      trim(org_name),
      coalesce(nullif(trim(org_timezone), ''), 'UTC'),
      org_business_hours,
      org_vertical_id,
      org_feature_flags
    )
    returning id into new_organization_id;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, current_user_id, 'owner')
  returning id into new_member_id;

  insert into public.business_centers (
    organization_id,
    name,
    code,
    timezone,
    business_hours,
    is_default,
    is_active
  )
  values (
    new_organization_id,
    'Main',
    'main',
    coalesce(nullif(trim(org_timezone), ''), 'UTC'),
    org_business_hours,
    true,
    true
  )
  returning id into new_business_center_id;

  insert into public.business_center_members (
    organization_id,
    business_center_id,
    organization_member_id,
    role
  )
  values (new_organization_id, new_business_center_id, new_member_id, 'manager');

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text, jsonb, uuid, jsonb) from public;
revoke all on function public.create_organization_with_owner(text, text, jsonb, uuid, jsonb) from anon;
grant execute on function public.create_organization_with_owner(text, text, jsonb, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  contact_id uuid references public.contacts(id) on delete set null,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_title_not_blank check (length(trim(title)) > 0),
  constraint appointments_ends_after_starts check (ends_at > starts_at),
  foreign key (organization_id, business_center_id)
    references public.business_centers (organization_id, id)
    on delete cascade
);

create index if not exists appointments_org_center_starts_idx
  on public.appointments (organization_id, business_center_id, starts_at);

create index if not exists appointments_assignee_idx
  on public.appointments (organization_id, assigned_to_user_id, starts_at)
  where assigned_to_user_id is not null;

create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;
alter table public.appointments force row level security;

create policy appointments_select_members
on public.appointments for select to authenticated
using (organization_id in (select private.user_org_ids()));

create policy appointments_insert_members
on public.appointments for insert to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy appointments_update_members
on public.appointments for update to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy appointments_delete_members
on public.appointments for delete to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;

-- ---------------------------------------------------------------------------
-- Facebook Messenger config
-- ---------------------------------------------------------------------------
create table if not exists public.facebook_config (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  page_id text,
  page_name text,
  access_token_encrypted text,
  webhook_verify_token text,
  connection_status text not null default 'not_configured'
    check (connection_status in ('not_configured', 'pending', 'connected', 'error', 'disconnected')),
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  verified_at timestamptz,
  last_status_check_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers (organization_id, id)
    on delete cascade,
  unique (organization_id, business_center_id)
);

create unique index if not exists facebook_config_page_id_uidx
  on public.facebook_config (page_id)
  where page_id is not null;

create trigger set_facebook_config_updated_at
before update on public.facebook_config
for each row execute function public.set_updated_at();

alter table public.facebook_config enable row level security;
alter table public.facebook_config force row level security;

create policy facebook_config_select_members
on public.facebook_config for select to authenticated
using (organization_id in (select private.user_org_ids()));

grant select on public.facebook_config to authenticated;
grant all on public.facebook_config to service_role;

create table if not exists public.facebook_message_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  business_center_id uuid,
  facebook_config_id uuid references public.facebook_config(id) on delete set null,
  page_id text,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'failed', 'ignored')),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists facebook_message_events_pending_idx
  on public.facebook_message_events (processing_status, created_at)
  where processing_status = 'pending';

grant all on public.facebook_message_events to service_role;

alter table public.conversations
  add column if not exists facebook_config_id uuid references public.facebook_config(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Dashboard: vertical slug + facebookConnection
-- ---------------------------------------------------------------------------
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
    order by my_org.created_at desc
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

revoke all on function public.get_owner_dashboard() from public;
revoke all on function public.get_owner_dashboard() from anon;
grant execute on function public.get_owner_dashboard() to authenticated;

-- List active verticals for onboarding
create or replace function public.list_organization_verticals()
returns table (
  id uuid,
  slug text,
  display_name text,
  description text,
  suggested_feature_flags jsonb,
  sort_order integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    id,
    slug,
    display_name,
    description,
    suggested_feature_flags,
    sort_order
  from public.organization_verticals
  where is_active = true
  order by sort_order asc, display_name asc
$$;

grant execute on function public.list_organization_verticals() to authenticated;
