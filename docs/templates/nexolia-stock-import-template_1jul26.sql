begin;

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Harina 000 granel 100 kg')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'HARINA-000-GRANEL-100-KG'),
    'Harina 000 granel 100 kg',
    'Producto base para fraccionado en presentaciones menores.',
    0,
    'ARS',
    100,
    20,
    'kg',
    'kg',
    1,
    null,
    '{"categoria":"Almacen","proveedor":"Molinos Norte","precio_costo_cents":125000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Producto base para fraccionado en presentaciones menores.',
    unit_price_cents = 0,
    stock_quantity = 100,
    reorder_threshold = 20,
    base_unit_code = 'kg',
    pricing_unit_code = 'kg',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Almacen","proveedor":"Molinos Norte","precio_costo_cents":125000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  100,
  20,
  'kg'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260115',
  100,
  100,
  'kg',
  125000,
  '2026-01-15T12:00:00.000Z'::timestamptz,
  '2026-12-31'::timestamptz,
  'Molinos Norte'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Harina 000 granel 100 kg');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Yerba mate Amanda 500g')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'YERBA-MATE-AMANDA-500G'),
    'Yerba mate Amanda 500g',
    'Yerba seleccionada para venta al público.',
    250000,
    'ARS',
    80,
    10,
    'paquete',
    'paquete',
    1,
    null,
    '{"categoria":"Almacen","proveedor":"tienda vgb","precio_costo_cents":180000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Yerba seleccionada para venta al público.',
    unit_price_cents = 250000,
    stock_quantity = 80,
    reorder_threshold = 10,
    base_unit_code = 'paquete',
    pricing_unit_code = 'paquete',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Almacen","proveedor":"tienda vgb","precio_costo_cents":180000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  80,
  10,
  'paquete'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260115',
  80,
  80,
  'paquete',
  180000,
  '2026-01-15T12:00:00.000Z'::timestamptz,
  null::timestamptz,
  'tienda vgb'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Yerba mate Amanda 500g');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Aceite girasol 900ml')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'ACEITE-GIRASOL-900ML'),
    'Aceite girasol 900ml',
    'Aceite de girasol 900 ml.',
    320000,
    'ARS',
    48,
    10,
    'botella',
    'botella',
    1,
    null,
    '{"categoria":"Aceites y vinagres","proveedor":"Aceitera del Sur","precio_costo_cents":220000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Aceite de girasol 900 ml.',
    unit_price_cents = 320000,
    stock_quantity = 48,
    reorder_threshold = 10,
    base_unit_code = 'botella',
    pricing_unit_code = 'botella',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Aceites y vinagres","proveedor":"Aceitera del Sur","precio_costo_cents":220000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  48,
  10,
  'botella'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260110',
  48,
  48,
  'botella',
  220000,
  '2026-01-10T12:00:00.000Z'::timestamptz,
  '2026-06-30'::timestamptz,
  'Aceitera del Sur'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Aceite girasol 900ml');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Café grano colombia granel 50 kg')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'CAFE-GRANO-COLOMBIA-GRAN'),
    'Café grano colombia granel 50 kg',
    'Producto base para fraccionado en presentaciones menores.',
    0,
    'ARS',
    100,
    20,
    'Kg',
    'Kg',
    1,
    null,
    '{"categoria":"Infusiones","proveedor":"valle colombia","precio_costo_cents":910000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Producto base para fraccionado en presentaciones menores.',
    unit_price_cents = 0,
    stock_quantity = 100,
    reorder_threshold = 20,
    base_unit_code = 'Kg',
    pricing_unit_code = 'Kg',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Infusiones","proveedor":"valle colombia","precio_costo_cents":910000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  100,
  20,
  'Kg'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260115',
  100,
  100,
  'Kg',
  910000,
  '2026-01-15T12:00:00.000Z'::timestamptz,
  null::timestamptz,
  'valle colombia'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Café grano colombia granel 50 kg');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Leche entera La Serenisima 1 l')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'LECHE-ENTERA-LA-SERENISI'),
    'Leche entera La Serenisima 1 l',
    null,
    150000,
    'ARS',
    30,
    8,
    'botella',
    'botella',
    1,
    null,
    '{"categoria":"Lacteos","proveedor":"tienda vgb","precio_costo_cents":100000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = null,
    unit_price_cents = 150000,
    stock_quantity = 30,
    reorder_threshold = 8,
    base_unit_code = 'botella',
    pricing_unit_code = 'botella',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Lacteos","proveedor":"tienda vgb","precio_costo_cents":100000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  30,
  8,
  'botella'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260615',
  30,
  30,
  'botella',
  100000,
  '2026-06-15T12:00:00.000Z'::timestamptz,
  '2026-09-10'::timestamptz,
  'tienda vgb'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Leche entera La Serenisima 1 l');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Yerba mate organica 100 kg')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'YERBA-MATE-ORGANICA-100-'),
    'Yerba mate organica 100 kg',
    'Producto base para fraccionado en presentaciones menores.',
    0,
    'ARS',
    500,
    20,
    'Kg',
    'Kg',
    1,
    null,
    '{"categoria":"Infusiones","proveedor":"Boutique calamuchita","precio_costo_cents":350000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Producto base para fraccionado en presentaciones menores.',
    unit_price_cents = 0,
    stock_quantity = 500,
    reorder_threshold = 20,
    base_unit_code = 'Kg',
    pricing_unit_code = 'Kg',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Infusiones","proveedor":"Boutique calamuchita","precio_costo_cents":350000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  500,
  20,
  'Kg'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260115',
  500,
  500,
  'Kg',
  350000,
  '2026-01-15T12:00:00.000Z'::timestamptz,
  null::timestamptz,
  'Boutique calamuchita'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Yerba mate organica 100 kg');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Leche entera La Serenisima 1 l')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'LECHE-ENTERA-LA-SERENISI-2'),
    'Leche entera La Serenisima 1 l',
    null,
    150000,
    'ARS',
    30,
    8,
    'botella',
    'botella',
    1,
    null,
    '{"categoria":"Lacteos","proveedor":"tienda vgb","precio_costo_cents":100000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = null,
    unit_price_cents = 150000,
    stock_quantity = 30,
    reorder_threshold = 8,
    base_unit_code = 'botella',
    pricing_unit_code = 'botella',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Lacteos","proveedor":"tienda vgb","precio_costo_cents":100000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  30,
  8,
  'botella'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260704',
  30,
  30,
  'botella',
  100000,
  '2026-07-04T12:00:00.000Z'::timestamptz,
  '2026-10-05'::timestamptz,
  'tienda vgb'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Leche entera La Serenisima 1 l');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Vino Tinto Trumpeter Malbec 750ml Botella Rutini Wines')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'VINO-TINTO-TRUMPETER-MAL'),
    'Vino Tinto Trumpeter Malbec 750ml Botella Rutini Wines',
    null,
    785000,
    'ARS',
    25,
    5,
    'botella',
    'botella',
    1,
    null,
    '{"categoria":"Bebida alcoholicas","proveedor":"tienda vgb","precio_costo_cents":650000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = null,
    unit_price_cents = 785000,
    stock_quantity = 25,
    reorder_threshold = 5,
    base_unit_code = 'botella',
    pricing_unit_code = 'botella',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Bebida alcoholicas","proveedor":"tienda vgb","precio_costo_cents":650000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  25,
  5,
  'botella'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260704',
  25,
  25,
  'botella',
  650000,
  '2026-07-04T12:00:00.000Z'::timestamptz,
  null::timestamptz,
  'tienda vgb'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Vino Tinto Trumpeter Malbec 750ml Botella Rutini Wines');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Monster Energy Rio Punch Lata 473ml')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'MONSTER-ENERGY-RIO-PUNCH'),
    'Monster Energy Rio Punch Lata 473ml',
    null,
    619000,
    'ARS',
    30,
    6,
    'Lata',
    'Lata',
    1,
    null,
    '{"categoria":"Aguas, Jugos y gaseosas","proveedor":"tienda vgb","precio_costo_cents":550000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = null,
    unit_price_cents = 619000,
    stock_quantity = 30,
    reorder_threshold = 6,
    base_unit_code = 'Lata',
    pricing_unit_code = 'Lata',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Aguas, Jugos y gaseosas","proveedor":"tienda vgb","precio_costo_cents":550000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  30,
  6,
  'Lata'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260704',
  30,
  30,
  'Lata',
  550000,
  '2026-07-04T12:00:00.000Z'::timestamptz,
  '2026-10-05'::timestamptz,
  'tienda vgb'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Monster Energy Rio Punch Lata 473ml');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Tajín Clásico 400g Origen México')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'TAJIN-CLASICO-400G-ORIGE'),
    'Tajín Clásico 400g Origen México',
    null,
    4950000,
    'ARS',
    20,
    2,
    'botella',
    'botella',
    1,
    null,
    '{"categoria":"Aderezos y condimentos","proveedor":"tienda vgb","precio_costo_cents":3500000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = null,
    unit_price_cents = 4950000,
    stock_quantity = 20,
    reorder_threshold = 2,
    base_unit_code = 'botella',
    pricing_unit_code = 'botella',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Aderezos y condimentos","proveedor":"tienda vgb","precio_costo_cents":3500000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  20,
  2,
  'botella'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260115',
  20,
  20,
  'botella',
  3500000,
  '2026-01-15T12:00:00.000Z'::timestamptz,
  '2027-10-05'::timestamptz,
  'tienda vgb'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Tajín Clásico 400g Origen México');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Castañas De Caju Natural Crudo')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'CASTANAS-DE-CAJU-NATURAL'),
    'Castañas De Caju Natural Crudo',
    'Venta x peso',
    1850000,
    'ARS',
    50,
    5,
    'Kg',
    'Kg',
    1,
    null,
    '{"categoria":"Frutos secos","proveedor":"Boutique calamuchita","precio_costo_cents":1250000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Venta x peso',
    unit_price_cents = 1850000,
    stock_quantity = 50,
    reorder_threshold = 5,
    base_unit_code = 'Kg',
    pricing_unit_code = 'Kg',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Frutos secos","proveedor":"Boutique calamuchita","precio_costo_cents":1250000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  50,
  5,
  'Kg'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260110',
  50,
  50,
  'Kg',
  1250000,
  '2026-01-10T12:00:00.000Z'::timestamptz,
  null::timestamptz,
  'Boutique calamuchita'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Castañas De Caju Natural Crudo');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Papas Fritas Lays Clásicas X 330 Gr')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'PAPAS-FRITAS-LAYS-CLASIC'),
    'Papas Fritas Lays Clásicas X 330 Gr',
    null,
    1050000,
    'ARS',
    30,
    5,
    'paquete',
    'paquete',
    1,
    null,
    '{"categoria":"Snacks","proveedor":"tienda vgb","precio_costo_cents":620000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = null,
    unit_price_cents = 1050000,
    stock_quantity = 30,
    reorder_threshold = 5,
    base_unit_code = 'paquete',
    pricing_unit_code = 'paquete',
    pricing_unit_quantity = 1,
    parent_product_id = null,
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Snacks","proveedor":"tienda vgb","precio_costo_cents":620000,"tipo_producto":"producto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  30,
  5,
  'paquete'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  p.id,
  'LOT-20260615',
  30,
  30,
  'paquete',
  620000,
  '2026-06-15T12:00:00.000Z'::timestamptz,
  '2026-09-10'::timestamptz,
  'tienda vgb'
from public.products p
where p.organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
  and lower(p.name) = lower('Papas Fritas Lays Clásicas X 330 Gr');

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Harina 000 1 kg')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'HARINA-000-1-KG'),
    'Harina 000 1 kg',
    'Presentación 1 kg derivada del granel.',
    190000,
    'ARS',
    26,
    5,
    'paquete',
    'paquete',
    1,
    (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Harina 000 granel 100 kg') limit 1),
    '{"categoria":"Almacen","proveedor":"Molinos Norte","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Presentación 1 kg derivada del granel.',
    unit_price_cents = 190000,
    stock_quantity = 26,
    reorder_threshold = 5,
    base_unit_code = 'paquete',
    pricing_unit_code = 'paquete',
    pricing_unit_quantity = 1,
    parent_product_id = (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Harina 000 granel 100 kg') limit 1),
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Almacen","proveedor":"Molinos Norte","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  26,
  5,
  'paquete'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Harina 000 3 kg')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'HARINA-000-3-KG'),
    'Harina 000 3 kg',
    'Presentación 3 kg derivada del granel.',
    500000,
    'ARS',
    10,
    5,
    'paquete',
    'paquete',
    1,
    (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Harina 000 granel 100 kg') limit 1),
    '{"categoria":"Almacen","proveedor":"Molinos Norte","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Presentación 3 kg derivada del granel.',
    unit_price_cents = 500000,
    stock_quantity = 10,
    reorder_threshold = 5,
    base_unit_code = 'paquete',
    pricing_unit_code = 'paquete',
    pricing_unit_quantity = 1,
    parent_product_id = (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Harina 000 granel 100 kg') limit 1),
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Almacen","proveedor":"Molinos Norte","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  10,
  5,
  'paquete'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Café grano colombia granel 250 g')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'CAFE-GRANO-COLOMBIA-GRAN-2'),
    'Café grano colombia granel 250 g',
    'Café en grano o molido',
    1400000,
    'ARS',
    20,
    5,
    'paquete',
    'paquete',
    1,
    (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Café grano colombia granel 50 kg') limit 1),
    '{"categoria":"Infusiones","proveedor":"valle colombia","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Café en grano o molido',
    unit_price_cents = 1400000,
    stock_quantity = 20,
    reorder_threshold = 5,
    base_unit_code = 'paquete',
    pricing_unit_code = 'paquete',
    pricing_unit_quantity = 1,
    parent_product_id = (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Café grano colombia granel 50 kg') limit 1),
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Infusiones","proveedor":"valle colombia","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  20,
  5,
  'paquete'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Yerba mate organica 500 g')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'YERBA-MATE-ORGANICA-500-'),
    'Yerba mate organica 500 g',
    'Presentación 500 g derivada del granel.',
    250000,
    'ARS',
    30,
    5,
    'paquete',
    'paquete',
    1,
    (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Yerba mate organica 100 kg') limit 1),
    '{"categoria":"Infusiones","proveedor":"Boutique calamuchita","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Presentación 500 g derivada del granel.',
    unit_price_cents = 250000,
    stock_quantity = 30,
    reorder_threshold = 5,
    base_unit_code = 'paquete',
    pricing_unit_code = 'paquete',
    pricing_unit_quantity = 1,
    parent_product_id = (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Yerba mate organica 100 kg') limit 1),
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Infusiones","proveedor":"Boutique calamuchita","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  30,
  5,
  'paquete'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();

with existing_product as (
  select id, sku
  from public.products
  where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8'
    and lower(name) = lower('Yerba mate organica 1 kg')
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    '546175ef-e9af-4db9-b685-ed59c439ddc8',
    coalesce((select sku from existing_product), 'YERBA-MATE-ORGANICA-1-KG'),
    'Yerba mate organica 1 kg',
    'Presentación 1 kg derivada del granel.',
    500000,
    'ARS',
    20,
    5,
    'paquete',
    'paquete',
    1,
    (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Yerba mate organica 100 kg') limit 1),
    '{"categoria":"Infusiones","proveedor":"Boutique calamuchita","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = 'Presentación 1 kg derivada del granel.',
    unit_price_cents = 500000,
    stock_quantity = 20,
    reorder_threshold = 5,
    base_unit_code = 'paquete',
    pricing_unit_code = 'paquete',
    pricing_unit_quantity = 1,
    parent_product_id = (select id from public.products where organization_id = '546175ef-e9af-4db9-b685-ed59c439ddc8' and lower(name) = lower('Yerba mate organica 100 kg') limit 1),
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"categoria":"Infusiones","proveedor":"Boutique calamuchita","tipo_producto":"subproducto","import_source":"stock_csv"}'::jsonb,
    is_active = true,
    updated_at = now()
  where p.id = (select id from existing_product)
  returning p.id, p.sku, p.name
),
product_row as (
  select * from upserted_product
  union all
  select * from updated_product
)
insert into public.inventory_items (
  organization_id, business_center_id, product_id, quantity_on_hand, reorder_threshold, unit_code
)
select
  '546175ef-e9af-4db9-b685-ed59c439ddc8',
  '769c9301-6c9c-4d7d-89ec-cbfb6aa73b79',
  product_row.id,
  20,
  5,
  'paquete'
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();
commit;