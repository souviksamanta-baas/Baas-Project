-- POS presupuestos (sell quotes) for Facturación — org/center scoped.

create table public.sell_quotes (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  status text not null
    check (status in ('guardado', 'enviado', 'aceptado', 'cobrado', 'cancelado', 'vencido')),
  draft jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade
);

create trigger set_sell_quotes_updated_at
before update on public.sell_quotes
for each row execute function public.set_updated_at();

create index sell_quotes_center_created_idx
on public.sell_quotes (organization_id, business_center_id, created_at desc);

create index sell_quotes_center_status_idx
on public.sell_quotes (organization_id, business_center_id, status, created_at desc);

alter table public.sell_quotes enable row level security;
alter table public.sell_quotes force row level security;

create policy sell_quotes_select_members
on public.sell_quotes
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy sell_quotes_insert_members
on public.sell_quotes
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy sell_quotes_update_members
on public.sell_quotes
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy sell_quotes_delete_members
on public.sell_quotes
for delete
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.sell_quotes to authenticated;
grant all on public.sell_quotes to service_role;
