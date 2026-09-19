-- Org-shared Proveedores registry + compras (with IVA / ajuste) + lines.

create table public.suppliers (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  comercio text not null,
  name text not null default '',
  email text,
  phone text,
  phone_e164 text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_comercio_not_blank check (length(trim(comercio)) > 0)
);

create unique index suppliers_org_comercio_uidx
on public.suppliers (organization_id, lower(trim(comercio)));

create index suppliers_organization_id_idx
on public.suppliers (organization_id);

create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.suppliers force row level security;

create policy suppliers_select_members
on public.suppliers
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy suppliers_insert_members
on public.suppliers
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy suppliers_update_members
on public.suppliers
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy suppliers_delete_members
on public.suppliers
for delete
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;

create table public.purchases (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  number text not null,
  supplier text not null default '',
  purchase_date date,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'confirmed')),
  item_count integer not null default 0 check (item_count >= 0),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  adjustment_kind text check (adjustment_kind in ('discount', 'surcharge')),
  adjustment_mode text check (adjustment_mode in ('percent', 'fixed')),
  adjustment_value numeric(12, 4) not null default 0,
  adjustment_cents integer not null default 0,
  iva_enabled boolean not null default false,
  iva_rate_percent numeric(5, 2) not null default 21
    check (iva_rate_percent in (0, 10.5, 21, 27)),
  iva_cents integer not null default 0 check (iva_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade,
  constraint purchases_number_not_blank check (length(trim(number)) > 0)
);

create unique index purchases_org_center_number_uidx
on public.purchases (organization_id, business_center_id, lower(trim(number)));

create index purchases_org_center_created_idx
on public.purchases (organization_id, business_center_id, created_at desc);

create trigger set_purchases_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();

alter table public.purchases enable row level security;
alter table public.purchases force row level security;

create policy purchases_select_members
on public.purchases
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy purchases_insert_members
on public.purchases
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy purchases_update_members
on public.purchases
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy purchases_delete_members
on public.purchases
for delete
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.purchases to authenticated;
grant all on public.purchases to service_role;

create table public.purchase_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity numeric(14, 4) not null check (quantity > 0),
  unit_code text not null default 'unit',
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  line_total_cents integer not null default 0 check (line_total_cents >= 0),
  cost text not null default '0',
  unit_price text not null default '0',
  margin_percent text not null default '0',
  expires_date text,
  lot_id uuid,
  previous_base_unit_code text,
  previous_metadata jsonb,
  previous_unit_price_cents integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index purchase_lines_purchase_id_idx
on public.purchase_lines (purchase_id, sort_order);

create index purchase_lines_organization_id_idx
on public.purchase_lines (organization_id);

alter table public.purchase_lines enable row level security;
alter table public.purchase_lines force row level security;

create policy purchase_lines_select_members
on public.purchase_lines
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy purchase_lines_insert_members
on public.purchase_lines
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy purchase_lines_update_members
on public.purchase_lines
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy purchase_lines_delete_members
on public.purchase_lines
for delete
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.purchase_lines to authenticated;
grant all on public.purchase_lines to service_role;
