-- Redesign domain model around verticals, business centers, and measured inventory.
-- This migration is intentionally backwards-compatible: current organization-level
-- settings and product stock columns remain while new code starts using the
-- default business center and measured inventory tables.

create table public.organization_verticals (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null,
  display_name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_verticals_slug_not_blank check (length(trim(slug)) > 0),
  constraint organization_verticals_display_name_not_blank check (length(trim(display_name)) > 0),
  unique (slug)
);

create trigger set_organization_verticals_updated_at
before update on public.organization_verticals
for each row execute function public.set_updated_at();

alter table public.organizations
add column if not exists vertical_id uuid references public.organization_verticals(id) on delete set null;

create table public.business_centers (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  timezone text not null default 'UTC',
  ai_auto_send boolean not null default false,
  ai_follow_up_delay_hours integer not null default 24 check (ai_follow_up_delay_hours >= 0),
  business_hours jsonb,
  address jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_centers_name_not_blank check (length(trim(name)) > 0),
  unique (organization_id, id)
);

create unique index business_centers_organization_code_idx
on public.business_centers (organization_id, code)
where code is not null;

create unique index business_centers_default_active_idx
on public.business_centers (organization_id)
where is_default = true and is_active = true;

create trigger set_business_centers_updated_at
before update on public.business_centers
for each row execute function public.set_updated_at();

insert into public.business_centers (
  organization_id,
  name,
  code,
  timezone,
  ai_auto_send,
  ai_follow_up_delay_hours,
  business_hours,
  is_default,
  is_active,
  created_at,
  updated_at
)
select
  organizations.id,
  'Main',
  'main',
  organizations.timezone,
  organizations.ai_auto_send,
  organizations.ai_follow_up_delay_hours,
  organizations.business_hours,
  true,
  true,
  organizations.created_at,
  now()
from public.organizations
where not exists (
  select 1
  from public.business_centers existing_centers
  where existing_centers.organization_id = organizations.id
);

create unique index if not exists organization_members_organization_id_id_idx
on public.organization_members (organization_id, id);

create table public.business_center_members (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  organization_member_id uuid not null,
  role text not null default 'staff' check (role in ('manager', 'staff')),
  created_at timestamptz not null default now(),
  unique (organization_id, business_center_id, organization_member_id),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade,
  foreign key (organization_id, organization_member_id)
    references public.organization_members(organization_id, id) on delete cascade
);

create index business_center_members_member_idx
on public.business_center_members (organization_member_id);

insert into public.business_center_members (
  organization_id,
  business_center_id,
  organization_member_id,
  role
)
select
  organization_members.organization_id,
  business_centers.id,
  organization_members.id,
  case when organization_members.role = 'owner' then 'manager' else 'staff' end
from public.organization_members
join public.business_centers
  on business_centers.organization_id = organization_members.organization_id
where business_centers.is_default = true
on conflict (organization_id, business_center_id, organization_member_id) do nothing;

alter table public.whatsapp_config add column if not exists business_center_id uuid;
alter table public.whatsapp_message_events add column if not exists business_center_id uuid;
alter table public.contacts add column if not exists business_center_id uuid;
alter table public.conversations add column if not exists business_center_id uuid;
alter table public.conversation_messages add column if not exists business_center_id uuid;
alter table public.products add column if not exists base_unit_code text not null default 'unit';
alter table public.products add column if not exists pricing_unit_quantity numeric(18, 6) not null default 1 check (pricing_unit_quantity > 0);
alter table public.products add column if not exists pricing_unit_code text not null default 'unit';
alter table public.products add column if not exists parent_product_id uuid references public.products(id) on delete set null;
alter table public.owner_tasks add column if not exists business_center_id uuid;
alter table public.owner_notifications add column if not exists business_center_id uuid;
alter table public.owner_device_tokens add column if not exists business_center_id uuid;
alter table public.ai_drafts add column if not exists business_center_id uuid;
alter table public.ai_draft_events add column if not exists business_center_id uuid;

update public.whatsapp_config rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.whatsapp_message_events rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.contacts rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.conversations rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.conversation_messages rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.owner_tasks rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.owner_notifications rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.owner_device_tokens rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.ai_drafts rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

update public.ai_draft_events rows_to_update
set business_center_id = default_centers.id
from public.business_centers default_centers
where default_centers.organization_id = rows_to_update.organization_id
  and default_centers.is_default = true
  and rows_to_update.business_center_id is null;

alter table public.whatsapp_config alter column business_center_id set not null;
alter table public.contacts alter column business_center_id set not null;
alter table public.conversations alter column business_center_id set not null;
alter table public.conversation_messages alter column business_center_id set not null;
alter table public.owner_tasks alter column business_center_id set not null;
alter table public.owner_notifications alter column business_center_id set not null;
alter table public.owner_device_tokens alter column business_center_id set not null;
alter table public.ai_drafts alter column business_center_id set not null;
alter table public.ai_draft_events alter column business_center_id set not null;

alter table public.whatsapp_config
add constraint whatsapp_config_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.whatsapp_message_events
add constraint whatsapp_message_events_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.contacts
add constraint contacts_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.conversations
add constraint conversations_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.conversation_messages
add constraint conversation_messages_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.owner_tasks
add constraint owner_tasks_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.owner_notifications
add constraint owner_notifications_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.owner_device_tokens
add constraint owner_device_tokens_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.ai_drafts
add constraint ai_drafts_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

alter table public.ai_draft_events
add constraint ai_draft_events_business_center_fk
foreign key (organization_id, business_center_id)
references public.business_centers(organization_id, id) on delete cascade;

create index if not exists contacts_business_center_last_seen_idx
on public.contacts (organization_id, business_center_id, last_seen_at desc);

create index if not exists conversations_business_center_last_message_idx
on public.conversations (organization_id, business_center_id, last_message_at desc);

create index if not exists conversation_messages_business_center_created_idx
on public.conversation_messages (organization_id, business_center_id, created_at desc);

create index if not exists products_unit_codes_idx
on public.products (organization_id, base_unit_code, pricing_unit_code);

create index if not exists owner_tasks_business_center_status_idx
on public.owner_tasks (organization_id, business_center_id, status, due_at);

create index if not exists owner_notifications_business_center_status_idx
on public.owner_notifications (organization_id, business_center_id, status, created_at desc);

create index if not exists ai_drafts_business_center_status_idx
on public.ai_drafts (organization_id, business_center_id, status, created_at desc);

create table public.inventory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_on_hand numeric(18, 6) not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved numeric(18, 6) not null default 0 check (quantity_reserved >= 0),
  unit_code text not null default 'unit',
  reorder_threshold numeric(18, 6) not null default 0 check (reorder_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, business_center_id, product_id),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade
);

create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create index inventory_items_low_stock_idx
on public.inventory_items (organization_id, business_center_id, quantity_on_hand, reorder_threshold);

create table public.inventory_lots (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  lot_code text,
  received_quantity numeric(18, 6) not null check (received_quantity >= 0),
  remaining_quantity numeric(18, 6) not null check (remaining_quantity >= 0),
  unit_code text not null default 'unit',
  unit_cost_cents integer check (unit_cost_cents is null or unit_cost_cents >= 0),
  received_at timestamptz not null default now(),
  expires_at timestamptz,
  supplier_reference text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade
);

create index inventory_lots_availability_idx
on public.inventory_lots (organization_id, business_center_id, product_id, remaining_quantity);

create table public.inventory_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  inventory_lot_id uuid references public.inventory_lots(id) on delete set null,
  movement_type text not null
    check (movement_type in ('restock', 'sale', 'adjustment', 'conversion_in', 'conversion_out', 'waste')),
  quantity_delta numeric(18, 6) not null,
  unit_code text not null default 'unit',
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade
);

create index inventory_movements_product_created_idx
on public.inventory_movements (organization_id, business_center_id, product_id, created_at desc);

create table public.inventory_transformations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  source_product_id uuid not null references public.products(id) on delete restrict,
  source_inventory_lot_id uuid references public.inventory_lots(id) on delete set null,
  target_product_id uuid not null references public.products(id) on delete restrict,
  input_quantity numeric(18, 6) not null check (input_quantity > 0),
  output_quantity numeric(18, 6) not null check (output_quantity >= 0),
  loss_quantity numeric(18, 6) not null default 0 check (loss_quantity >= 0),
  unit_code text not null default 'unit',
  created_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade
);

insert into public.inventory_items (
  organization_id,
  business_center_id,
  product_id,
  quantity_on_hand,
  unit_code,
  reorder_threshold,
  created_at,
  updated_at
)
select
  products.organization_id,
  business_centers.id,
  products.id,
  products.stock_quantity::numeric,
  products.base_unit_code,
  products.reorder_threshold::numeric,
  products.created_at,
  now()
from public.products
join public.business_centers
  on business_centers.organization_id = products.organization_id
where business_centers.is_default = true
on conflict (organization_id, business_center_id, product_id) do nothing;

alter table public.organization_verticals enable row level security;
alter table public.organization_verticals force row level security;
alter table public.business_centers enable row level security;
alter table public.business_centers force row level security;
alter table public.business_center_members enable row level security;
alter table public.business_center_members force row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_items force row level security;
alter table public.inventory_lots enable row level security;
alter table public.inventory_lots force row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_movements force row level security;
alter table public.inventory_transformations enable row level security;
alter table public.inventory_transformations force row level security;

create policy organization_verticals_select_authenticated
on public.organization_verticals
for select
to authenticated
using (is_active = true);

create policy business_centers_select_members
on public.business_centers
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy business_centers_update_owners
on public.business_centers
for update
to authenticated
using (private.is_org_owner(organization_id))
with check (private.is_org_owner(organization_id));

create policy business_center_members_select_members
on public.business_center_members
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy inventory_items_select_members
on public.inventory_items
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy inventory_items_write_members
on public.inventory_items
for all
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy inventory_lots_select_members
on public.inventory_lots
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy inventory_movements_select_members
on public.inventory_movements
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy inventory_transformations_select_members
on public.inventory_transformations
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select on public.organization_verticals to authenticated;
grant select, update on public.business_centers to authenticated;
grant select on public.business_center_members to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select on public.inventory_lots to authenticated;
grant select on public.inventory_movements to authenticated;
grant select on public.inventory_transformations to authenticated;
grant all on public.organization_verticals to service_role;
grant all on public.business_centers to service_role;
grant all on public.business_center_members to service_role;
grant all on public.inventory_items to service_role;
grant all on public.inventory_lots to service_role;
grant all on public.inventory_movements to service_role;
grant all on public.inventory_transformations to service_role;

drop function if exists public.get_owner_dashboard();
drop function if exists public.get_my_organizations();

create or replace function public.get_my_organizations()
returns table (
  organization_id uuid,
  name text,
  role text,
  timezone text,
  ai_auto_send boolean,
  ai_follow_up_delay_hours integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    organizations.id as organization_id,
    organizations.name,
    organization_members.role,
    coalesce(default_centers.timezone, organizations.timezone) as timezone,
    coalesce(default_centers.ai_auto_send, organizations.ai_auto_send) as ai_auto_send,
    coalesce(default_centers.ai_follow_up_delay_hours, organizations.ai_follow_up_delay_hours) as ai_follow_up_delay_hours,
    organizations.created_at
  from public.organization_members
  join public.organizations on organizations.id = organization_members.organization_id
  left join public.business_centers default_centers
    on default_centers.organization_id = organizations.id
   and default_centers.is_default = true
   and default_centers.is_active = true
  where organization_members.user_id = auth.uid()
  order by organizations.created_at asc
$$;

revoke all on function public.get_my_organizations() from public;
revoke all on function public.get_my_organizations() from anon;
grant execute on function public.get_my_organizations() to authenticated;

create or replace function public.create_organization_with_owner(
  org_name text,
  org_timezone text default 'UTC',
  org_business_hours jsonb default null
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

  insert into public.organizations (name, timezone, business_hours)
  values (trim(org_name), coalesce(nullif(trim(org_timezone), ''), 'UTC'), org_business_hours)
  returning id into new_organization_id;

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

revoke all on function public.create_organization_with_owner(text, text, jsonb) from public;
revoke all on function public.create_organization_with_owner(text, text, jsonb) from anon;
grant execute on function public.create_organization_with_owner(text, text, jsonb) to authenticated;

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
      coalesce((select count(*) from public.ai_drafts d join active_org ao on ao.organization_id = d.organization_id and ao.business_center_id = d.business_center_id where d.status = 'pending_approval'), 0) as pending_ai_drafts
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
