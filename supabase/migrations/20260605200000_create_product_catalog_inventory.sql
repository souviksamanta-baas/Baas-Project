-- Phase 2 product catalog and inventory foundation.
-- Product rows are tenant-scoped and owner-editable through authenticated RLS.

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  description text,
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  currency text not null default 'USD' check (length(currency) = 3),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reorder_threshold integer not null default 0 check (reorder_threshold >= 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  unique (organization_id, sku)
);

create index products_organization_id_idx
on public.products (organization_id);

create index products_organization_name_idx
on public.products (organization_id, lower(name));

create index products_low_stock_idx
on public.products (organization_id, stock_quantity, reorder_threshold)
where is_active = true;

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.products force row level security;

create policy products_select_members
on public.products
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy products_insert_members
on public.products
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy products_update_members
on public.products
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy products_delete_members
on public.products
for delete
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.products;
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
      coalesce((select count(*) from public.products p join active_org ao on ao.organization_id = p.organization_id where p.is_active = true and p.stock_quantity <= p.reorder_threshold), 0) as low_stock_items
  )
  select jsonb_build_object(
    'shouldOnboard', not exists (select 1 from active_org),
    'organization', (
      select jsonb_build_object(
        'id', organization_id,
        'name', name,
        'role', role,
        'timezone', timezone
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
        'pendingFollowUps', 0
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
