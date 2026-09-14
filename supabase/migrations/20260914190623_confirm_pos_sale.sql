-- Atomic POS confirm (NEX-004 / NEX-012 / KAN-437).
-- Conditional stock decrement + movements + optional quote cobrado in one transaction.
-- Idempotent per (organization_id, idempotency_key).

create table if not exists public.pos_sale_receipts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null,
  quote_id text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, idempotency_key)
);

create index if not exists pos_sale_receipts_quote_idx
  on public.pos_sale_receipts (organization_id, quote_id)
  where quote_id is not null;

alter table public.pos_sale_receipts enable row level security;
alter table public.pos_sale_receipts force row level security;

create policy pos_sale_receipts_select_members
on public.pos_sale_receipts
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select on public.pos_sale_receipts to authenticated;
grant all on public.pos_sale_receipts to service_role;

create or replace function public.confirm_pos_sale(
  p_organization_id uuid,
  p_business_center_id uuid,
  p_idempotency_key text,
  p_lines jsonb,
  p_quote_id text default null,
  p_client_label text default null,
  p_draft jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing jsonb;
  v_line jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_note text;
  v_item public.inventory_items%rowtype;
  v_product_name text;
  v_quote_status text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key is required';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'cart is empty';
  end if;

  if not exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = v_uid
  ) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_organization_id::text),
    hashtext(p_idempotency_key)
  );

  select result
    into v_existing
  from public.pos_sale_receipts
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return v_existing;
  end if;

  if p_quote_id is not null then
    select status
      into v_quote_status
    from public.sell_quotes
    where id = p_quote_id
      and organization_id = p_organization_id
      and business_center_id = p_business_center_id
    for update;

    if not found then
      raise exception 'quote not found';
    end if;

    if v_quote_status = 'cobrado' then
      raise exception 'quote already paid';
    end if;
  end if;

  for v_line in
    select jsonb_array_elements(p_lines)
  loop
    v_product_id := (v_line->>'productId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_note := nullif(v_line->>'note', '');

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'invalid cart line';
    end if;

    select *
      into v_item
    from public.inventory_items
    where organization_id = p_organization_id
      and business_center_id = p_business_center_id
      and product_id = v_product_id
    for update;

    if not found then
      raise exception 'stock not found for product %', v_product_id;
    end if;

    select name into v_product_name from public.products where id = v_product_id;

    if v_item.quantity_on_hand < v_qty then
      raise exception 'insufficient_stock:%:%:%',
        coalesce(v_product_name, 'producto'),
        v_qty,
        v_item.quantity_on_hand;
    end if;

    update public.inventory_items
    set quantity_on_hand = quantity_on_hand - v_qty
    where id = v_item.id
      and organization_id = p_organization_id
      and quantity_on_hand >= v_qty;

    if not found then
      raise exception 'insufficient_stock:%:%:%',
        coalesce(v_product_name, 'producto'),
        v_qty,
        v_item.quantity_on_hand;
    end if;

    insert into public.inventory_movements (
      organization_id,
      business_center_id,
      product_id,
      inventory_item_id,
      inventory_lot_id,
      movement_type,
      quantity_delta,
      unit_code,
      reference_type,
      note
    )
    values (
      p_organization_id,
      p_business_center_id,
      v_product_id,
      v_item.id,
      null,
      'sale',
      -v_qty,
      v_item.unit_code,
      'pos_sale',
      v_note
    );
  end loop;

  if p_quote_id is not null then
    update public.sell_quotes
    set
      status = 'cobrado',
      draft = coalesce(p_draft, draft)
    where id = p_quote_id
      and organization_id = p_organization_id
      and business_center_id = p_business_center_id;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'idempotencyKey', p_idempotency_key,
    'quoteId', p_quote_id,
    'quoteStatus', case when p_quote_id is null then null else 'cobrado' end
  );

  insert into public.pos_sale_receipts (
    organization_id,
    idempotency_key,
    quote_id,
    result
  )
  values (
    p_organization_id,
    p_idempotency_key,
    p_quote_id,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.confirm_pos_sale(uuid, uuid, text, jsonb, text, text, jsonb) from public;
grant execute on function public.confirm_pos_sale(uuid, uuid, text, jsonb, text, text, jsonb) to authenticated;
