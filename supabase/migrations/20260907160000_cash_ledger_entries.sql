-- Daily cash ledger (Caja) scoped to organization + business center.

create table public.cash_ledger_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null,
  entry_date date not null,
  entry_type text not null check (entry_type in ('ingreso', 'egreso')),
  amount_cents integer not null check (amount_cents > 0),
  source text not null check (
    source in ('manual', 'venta', 'compra', 'stock')
  ),
  source_id text,
  concept text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, business_center_id)
    references public.business_centers(organization_id, id) on delete cascade,
  constraint cash_ledger_entries_concept_not_blank check (
    source <> 'manual' or length(trim(concept)) > 0
  )
);

create trigger set_cash_ledger_entries_updated_at
before update on public.cash_ledger_entries
for each row execute function public.set_updated_at();

create index cash_ledger_entries_day_idx
on public.cash_ledger_entries (organization_id, business_center_id, entry_date, created_at);

create unique index cash_ledger_entries_auto_source_uidx
on public.cash_ledger_entries (organization_id, business_center_id, source, source_id)
where source <> 'manual' and source_id is not null;

alter table public.cash_ledger_entries enable row level security;
alter table public.cash_ledger_entries force row level security;

create policy cash_ledger_entries_select_members
on public.cash_ledger_entries
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy cash_ledger_entries_insert_members
on public.cash_ledger_entries
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy cash_ledger_entries_update_members
on public.cash_ledger_entries
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

create policy cash_ledger_entries_delete_members
on public.cash_ledger_entries
for delete
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.cash_ledger_entries to authenticated;
grant all on public.cash_ledger_entries to service_role;
