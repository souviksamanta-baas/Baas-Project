-- Normalized org product categories (many-to-many) + Granel catalog seed (unassigned).

create table public.product_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint product_categories_name_not_blank check (length(trim(name)) > 0)
);

create unique index product_categories_org_name_uidx
on public.product_categories (organization_id, lower(trim(name)));

create index product_categories_organization_id_idx
on public.product_categories (organization_id)
where archived_at is null;

create table public.product_category_links (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index product_category_links_category_id_idx
on public.product_category_links (category_id);

-- Org default IVA alícuota for compras (21 / 10.5 / 27 / 0).
alter table public.organizations
  add column if not exists default_iva_rate_percent numeric(5, 2) not null default 21
  constraint organizations_default_iva_rate_percent_check
  check (default_iva_rate_percent in (0, 10.5, 21, 27));

alter table public.product_categories enable row level security;
alter table public.product_categories force row level security;

create policy product_categories_select_members
on public.product_categories
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy product_categories_insert_members
on public.product_categories
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy product_categories_update_members
on public.product_categories
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy product_categories_delete_members
on public.product_categories
for delete
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.product_categories to authenticated;
grant all on public.product_categories to service_role;

alter table public.product_category_links enable row level security;
alter table public.product_category_links force row level security;

create policy product_category_links_select_members
on public.product_category_links
for select
to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.organization_id in (select private.user_org_ids())
  )
);

create policy product_category_links_insert_members
on public.product_category_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.organization_id in (select private.user_org_ids())
  )
  and exists (
    select 1
    from public.product_categories c
    where c.id = category_id
      and c.organization_id in (select private.user_org_ids())
  )
);

create policy product_category_links_delete_members
on public.product_category_links
for delete
to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.organization_id in (select private.user_org_ids())
  )
);

grant select, insert, delete on public.product_category_links to authenticated;
grant all on public.product_category_links to service_role;

-- Backfill categories + links from products.metadata.categoria (single string).
insert into public.product_categories (organization_id, name)
select distinct
  p.organization_id,
  trim(p.metadata->>'categoria')
from public.products p
where coalesce(trim(p.metadata->>'categoria'), '') <> ''
  and not exists (
    select 1
    from public.product_categories existing
    where existing.organization_id = p.organization_id
      and lower(trim(existing.name)) = lower(trim(p.metadata->>'categoria'))
  );

insert into public.product_category_links (product_id, category_id)
select
  p.id,
  c.id
from public.products p
join public.product_categories c
  on c.organization_id = p.organization_id
 and lower(trim(c.name)) = lower(trim(p.metadata->>'categoria'))
where coalesce(trim(p.metadata->>'categoria'), '') <> ''
on conflict do nothing;

-- Seed Granel catalog row for every org that already has products (do not auto-link).
insert into public.product_categories (organization_id, name)
select distinct p.organization_id, 'Granel'
from public.products p
where not exists (
  select 1
  from public.product_categories existing
  where existing.organization_id = p.organization_id
    and lower(trim(existing.name)) = 'granel'
);
