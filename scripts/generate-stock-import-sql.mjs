#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const organizationId = process.argv[2];
const businessCenterId = process.argv[3];
const filePath = process.argv[4];

if (!organizationId || !businessCenterId || !filePath) {
  console.error('Usage: node scripts/generate-stock-import-sql.mjs <org-id> <center-id> <csv-file> [output.sql]');
  process.exit(1);
}

const outputPath = process.argv[5] ?? '/tmp/nexolia-stock-import.sql';

function parseCsv(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const [headerLine, ...dataLines] = lines;
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const headers = headerLine.split(delimiter).map((value) => value.trim());
  return dataLines.map((line) => {
    const values = line.split(delimiter).map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function sqlText(value) {
  if (value == null || value === '') return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function normalizeText(value) {
  return value?.trim() ?? '';
}

function slugifySku(name) {
  return (
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'PRODUCTO'
  );
}

function parsePesos(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;
  return Math.round(Number.parseFloat(trimmed.replace(',', '.')) * 100);
}

function parseFecha(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  return {
    isoDate: `${year}-${month}-${day}`,
    lotCodeBase: `LOT-${year}${month}${day}`,
  };
}

function parseTipoProducto(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'subproducto' ? 'subproducto' : 'producto';
}

const rows = parseCsv(readFileSync(filePath, 'utf8')).sort((left, right) => {
  const leftType = parseTipoProducto(left.tipo_producto);
  const rightType = parseTipoProducto(right.tipo_producto);
  if (leftType === rightType) return 0;
  return leftType === 'producto' ? -1 : 1;
});

const reservedSkus = new Set();
const importedByName = new Map();
const lotCounters = new Map();
const statements = ['begin;'];

function reserveSku(name) {
  let base = slugifySku(name);
  let candidate = base;
  let suffix = 2;
  while (reservedSkus.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  reservedSkus.add(candidate);
  return candidate;
}

function buildLotCode(lotCodeBase, sku) {
  const key = `${sku}:${lotCodeBase}`;
  const next = (lotCounters.get(key) ?? 0) + 1;
  lotCounters.set(key, next);
  return next === 1 ? lotCodeBase : `${lotCodeBase}-${String(next).padStart(2, '0')}`;
}

for (const row of rows) {
  const productName = normalizeText(row.nombre_producto);
  const tipoProducto = parseTipoProducto(row.tipo_producto);
  const parentName = normalizeText(row.producto_base);
  const salePriceCents = parsePesos(row.precio_venta) ?? 0;
  const costPriceCents = parsePesos(row.precio_costo);
  const quantityOnHand = Number.parseFloat(normalizeText(row.cantidad_stock) || '0');
  const reorderThreshold = Number.parseFloat(normalizeText(row.umbral_reorden) || '0');
  const unitCode = normalizeText(row.unidad) || 'unit';
  const category = normalizeText(row.categoria) || null;
  const vendor = normalizeText(row.proveedor) || null;
  const notes = normalizeText(row.notas) || null;
  const sku = reserveSku(productName);
  const metadata = {
    ...(category ? { categoria: category } : {}),
    ...(vendor ? { proveedor: vendor } : {}),
    ...(costPriceCents != null ? { precio_costo_cents: costPriceCents } : {}),
    tipo_producto: tipoProducto,
    import_source: 'stock_csv',
  };

  const parentSql =
    tipoProducto === 'subproducto' && parentName
      ? `(select id from public.products where organization_id = ${sqlText(organizationId)} and lower(name) = lower(${sqlText(parentName)}) limit 1)`
      : 'null';

  statements.push(`
with existing_product as (
  select id, sku
  from public.products
  where organization_id = ${sqlText(organizationId)}
    and lower(name) = lower(${sqlText(productName)})
  limit 1
),
upserted_product as (
  insert into public.products (
    organization_id, sku, name, description, unit_price_cents, currency,
    stock_quantity, reorder_threshold, base_unit_code, pricing_unit_code,
    pricing_unit_quantity, parent_product_id, metadata, is_active
  )
  select
    ${sqlText(organizationId)},
    coalesce((select sku from existing_product), ${sqlText(sku)}),
    ${sqlText(productName)},
    ${sqlText(notes)},
    ${salePriceCents},
    'ARS',
    ${Math.round(quantityOnHand)},
    ${Math.round(reorderThreshold)},
    ${sqlText(unitCode)},
    ${sqlText(unitCode)},
    1,
    ${parentSql},
    ${sqlJson(metadata)},
    true
  where not exists (select 1 from existing_product)
  returning id, sku, name
),
updated_product as (
  update public.products p
  set
    description = ${sqlText(notes)},
    unit_price_cents = ${salePriceCents},
    stock_quantity = ${Math.round(quantityOnHand)},
    reorder_threshold = ${Math.round(reorderThreshold)},
    base_unit_code = ${sqlText(unitCode)},
    pricing_unit_code = ${sqlText(unitCode)},
    pricing_unit_quantity = 1,
    parent_product_id = ${parentSql},
    metadata = coalesce(p.metadata, '{}'::jsonb) || ${sqlJson(metadata)},
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
  ${sqlText(organizationId)},
  ${sqlText(businessCenterId)},
  product_row.id,
  ${quantityOnHand},
  ${reorderThreshold},
  ${sqlText(unitCode)}
from product_row
on conflict (organization_id, business_center_id, product_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  reorder_threshold = excluded.reorder_threshold,
  unit_code = excluded.unit_code,
  updated_at = now();`);

  const loteFecha = parseFecha(row.lote_fecha);
  if (loteFecha) {
    const lotCode = buildLotCode(loteFecha.lotCodeBase, sku);
    const expiresAt = parseFecha(row.fecha_vencimiento)?.isoDate ?? null;
    statements.push(`
insert into public.inventory_lots (
  organization_id, business_center_id, product_id, lot_code,
  received_quantity, remaining_quantity, unit_code, unit_cost_cents,
  received_at, expires_at, supplier_reference
)
select
  ${sqlText(organizationId)},
  ${sqlText(businessCenterId)},
  p.id,
  ${sqlText(lotCode)},
  ${quantityOnHand},
  ${quantityOnHand},
  ${sqlText(unitCode)},
  ${costPriceCents == null ? 'null' : costPriceCents},
  ${sqlText(`${loteFecha.isoDate}T12:00:00.000Z`)}::timestamptz,
  ${expiresAt ? sqlText(expiresAt) : 'null'}::timestamptz,
  ${vendor ? sqlText(vendor) : 'null'}
from public.products p
where p.organization_id = ${sqlText(organizationId)}
  and lower(p.name) = lower(${sqlText(productName)});`);
  }

  importedByName.set(productName, sku);
}

statements.push('commit;');
writeFileSync(outputPath, statements.join('\n'));
console.log(outputPath);
