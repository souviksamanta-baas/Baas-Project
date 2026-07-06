#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...dataLines] = lines;
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const headers = headerLine.split(delimiter).map((value) => value.trim());

  return dataLines.map((line) => {
    const values = line.split(delimiter).map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function normalizeText(value) {
  return value?.trim() ?? '';
}

function parsePesos(value, fieldName) {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return null;
  }

  const amount = Number.parseFloat(trimmed.replace(',', '.'));
  if (Number.isNaN(amount) || amount < 0) {
    throw new Error(`${fieldName} inv?lido "${value}". Us? un n?mero en pesos enteros.`);
  }

  return Math.round(amount * 100);
}

function parsePositiveNumber(value, fieldName, fallback = null) {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return fallback;
  }

  const amount = Number.parseFloat(trimmed.replace(',', '.'));
  if (Number.isNaN(amount) || amount < 0) {
    throw new Error(`${fieldName} inv?lido "${value}".`);
  }

  return amount;
}

function parseBaseUnitEquivalent(value, fieldName) {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return null;
  }

  const amount = Number.parseFloat(trimmed.replace(',', '.'));
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error(
      `${fieldName} inv?lido "${value}". Us? un n?mero decimal mayor a 0 (ej. 0.25, .5 o 1).`,
    );
  }

  return amount;
}

function slugifySku(name) {
  const base =
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'PRODUCTO';

  return base;
}

function parseFechaDdMmYyyy(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`Fecha inv?lida "${value}". Us? dd/mm/aaaa.`);
  }

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
  if (!normalized || normalized === 'producto') {
    return 'producto';
  }
  if (normalized === 'subproducto') {
    return 'subproducto';
  }
  throw new Error(`tipo_producto inv?lido "${value}". Us? "producto" o "subproducto".`);
}

function buildLotCode(lotCodeBase, productSku, lotCounters) {
  const key = `${productSku}:${lotCodeBase}`;
  const next = (lotCounters.get(key) ?? 0) + 1;
  lotCounters.set(key, next);
  return next === 1 ? lotCodeBase : `${lotCodeBase}-${String(next).padStart(2, '0')}`;
}

function stockKey(productId, businessCenterId) {
  return `${productId}:${businessCenterId}`;
}

function resolveBusinessCenterId(row, context) {
  const branchName = normalizeText(row.sucursal);
  if (branchName) {
    const match = context.businessCentersByName.get(branchName.toLowerCase());
    if (!match) {
      const available = [...context.businessCentersByName.values()]
        .map((center) => center.name)
        .join(', ');
      throw new Error(
        `Sucursal "${branchName}" no encontrada. Sucursales disponibles: ${available || '(ninguna)'}.`,
      );
    }
    return match.id;
  }

  if (context.defaultBusinessCenterId) {
    return context.defaultBusinessCenterId;
  }

  throw new Error(
    `Falta sucursal en la fila de "${normalizeText(row.nombre_producto)}". Complet? la columna sucursal o pas? --business-center-id.`,
  );
}

const organizationId = readArg('--organization-id');
const defaultBusinessCenterId = readArg('--business-center-id');
const filePath = readArg('--file');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!organizationId || !filePath || !supabaseUrl || !serviceRoleKey) {
  console.error(
    'Usage: node scripts/import-stock-csv.mjs --organization-id <uuid> [--business-center-id <uuid>] --file <path.csv>\nRequires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function loadBusinessCenters() {
  const { data, error } = await supabase
    .from('business_centers')
    .select('id, name, code, is_default')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (error) {
    throw new Error(`No se pudieron cargar sucursales: ${error.message}`);
  }

  const businessCentersByName = new Map();
  for (const center of data ?? []) {
    businessCentersByName.set(center.name.toLowerCase(), center);
    if (center.code) {
      businessCentersByName.set(center.code.toLowerCase(), center);
    }
  }

  const defaultCenter =
    data?.find((center) => center.id === defaultBusinessCenterId) ??
    data?.find((center) => center.is_default) ??
    data?.[0] ??
    null;

  return {
    businessCentersByName,
    defaultBusinessCenterId: defaultCenter?.id ?? defaultBusinessCenterId ?? null,
  };
}

async function findProductByName(productName) {
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, metadata, name')
    .eq('organization_id', organizationId)
    .ilike('name', productName)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo buscar "${productName}": ${error.message}`);
  }

  return data;
}

async function findExistingLot(productId, businessCenterId, lotCode) {
  const { data, error } = await supabase
    .from('inventory_lots')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('product_id', productId)
    .eq('lot_code', lotCode)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo verificar lote "${lotCode}": ${error.message}`);
  }

  return data?.id ?? null;
}

async function findLatestParentLot(parentProductId, businessCenterId) {
  const { data, error } = await supabase
    .from('inventory_lots')
    .select('lot_code, received_at, expires_at, unit_cost_cents, supplier_reference')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('product_id', parentProductId)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer lote del producto base: ${error.message}`);
  }

  return data;
}

async function resolveUniqueSku(productName, reservedSkus) {
  const base = slugifySku(productName);
  let candidate = base;
  let suffix = 2;

  while (reservedSkus.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  const { data: existingBySku } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('sku', candidate)
    .maybeSingle();

  if (existingBySku) {
    reservedSkus.add(candidate);
    return resolveUniqueSku(`${productName} ${suffix}`, reservedSkus);
  }

  reservedSkus.add(candidate);
  return candidate;
}

function resolveInheritedLot(row, context, parentName, parentProductId, businessCenterId) {
  const cached = context.latestLotByProductName.get(parentName.toLowerCase());
  if (cached && cached.businessCenterId === businessCenterId) {
    return cached;
  }

  return findLatestParentLot(parentProductId, businessCenterId).then((parentLot) => {
    if (!parentLot) {
      return null;
    }

    const receivedAt = parentLot.received_at;
    const isoDate = receivedAt.slice(0, 10);
    const lotCodeBase = parentLot.lot_code?.startsWith('LOT-')
      ? parentLot.lot_code
      : `LOT-${isoDate.replace(/-/g, '')}`;

    return {
      isoDate,
      lotCodeBase,
      expiresAt: parentLot.expires_at?.slice(0, 10) ?? null,
      costPriceCents: parentLot.unit_cost_cents,
      vendor: parentLot.supplier_reference,
      businessCenterId,
    };
  });
}

async function importRow(row, context) {
  const productName = normalizeText(row.nombre_producto);
  if (!productName) {
    throw new Error(`Fila inv?lida: falta nombre_producto (${JSON.stringify(row)})`);
  }

  const businessCenterId = resolveBusinessCenterId(row, context);
  const tipoProducto = parseTipoProducto(row.tipo_producto);
  const parentName = normalizeText(row.producto_base);
  if (tipoProducto === 'subproducto' && !parentName) {
    throw new Error(`"${productName}" es subproducto pero falta producto_base.`);
  }

  const baseUnitEquivalent =
    tipoProducto === 'subproducto'
      ? parseBaseUnitEquivalent(row.equivalente_unidad_base, 'equivalente_unidad_base')
      : null;

  if (tipoProducto === 'subproducto' && baseUnitEquivalent === null) {
    throw new Error(
      `"${productName}" es subproducto pero falta equivalente_unidad_base (cu?ntas unidades del producto base consume cada unidad de este subproducto).`,
    );
  }

  const salePriceCents =
    parsePesos(row.precio_venta, 'precio_venta') ??
    parsePesos(row.precio_ars, 'precio_ars') ??
    0;
  let costPriceCents = parsePesos(row.precio_costo, 'precio_costo');

  let parentProductId = null;
  if (tipoProducto === 'subproducto') {
    const parent =
      context.importedByName.get(parentName) ?? (await findProductByName(parentName));
    if (!parent) {
      throw new Error(
        `No se encontr? el producto base "${parentName}" para el subproducto "${productName}". Import? primero los productos base.`,
      );
    }
    parentProductId = parent.id;

    if (costPriceCents == null && parent.metadata?.precio_costo_cents != null && baseUnitEquivalent != null) {
      costPriceCents = Math.round(Number(parent.metadata.precio_costo_cents) * baseUnitEquivalent);
    }
  }

  if (costPriceCents == null && parentName) {
    const parentRow = context.rowsByName.get(parentName.toLowerCase());
    const parentCostFromCsv = parentRow ? parsePesos(parentRow.precio_costo, 'precio_costo') : null;
    if (parentCostFromCsv != null && baseUnitEquivalent != null) {
      costPriceCents = Math.round(parentCostFromCsv * baseUnitEquivalent);
    }
  }

  const quantityOnHand = parsePositiveNumber(row.cantidad_stock, 'cantidad_stock', 0);
  const reorderThreshold = parsePositiveNumber(row.umbral_reorden, 'umbral_reorden', 0);
  const unitCode = normalizeText(row.unidad) || 'unit';
  const category = normalizeText(row.categoria) || null;
  const vendor = normalizeText(row.proveedor) || null;
  const barcode = normalizeText(row.codigo_barras) || null;
  const notes =
    normalizeText(row.notas) || normalizeText(row.descripcion) || null;

  let existing = await findProductByName(productName);
  const sku = existing?.sku ?? (await resolveUniqueSku(productName, context.reservedSkus));
  const metadata = {
    ...(existing?.metadata ?? {}),
    ...(category ? { categoria: category } : {}),
    ...(vendor ? { proveedor: vendor } : {}),
    ...(barcode ? { codigo_barras: barcode } : {}),
    ...(costPriceCents != null ? { precio_costo_cents: costPriceCents } : {}),
    ...(baseUnitEquivalent != null ? { equivalente_unidad_base: baseUnitEquivalent } : {}),
    tipo_producto: tipoProducto,
    import_source: 'stock_csv',
  };

  const itemStockKeyBeforeInsert = existing?.id
    ? stockKey(existing.id, businessCenterId)
    : null;

  const productPayload = {
    organization_id: organizationId,
    sku,
    name: productName,
    description: notes,
    unit_price_cents: salePriceCents,
    currency: 'ARS',
    stock_quantity: Math.round(
      (context.stockTotals.get(itemStockKeyBeforeInsert) ?? 0) + quantityOnHand,
    ),
    reorder_threshold: Math.round(reorderThreshold),
    base_unit_code: unitCode,
    pricing_unit_code: unitCode,
    pricing_unit_quantity: 1,
    parent_product_id: parentProductId,
    metadata,
    is_active: true,
  };

  const productQuery = existing
    ? supabase.from('products').update(productPayload).eq('id', existing.id)
    : supabase.from('products').insert(productPayload);

  const { data: product, error: productError } = await productQuery.select('id, sku, name').single();

  if (productError) {
    throw new Error(`No se pudo guardar "${productName}": ${productError.message}`);
  }

  context.importedByName.set(product.name, product);

  const runningStock =
    (context.stockTotals.get(stockKey(product.id, businessCenterId)) ?? 0) + quantityOnHand;
  context.stockTotals.set(stockKey(product.id, businessCenterId), runningStock);

  const { error: inventoryError } = await supabase.from('inventory_items').upsert(
    {
      organization_id: organizationId,
      business_center_id: businessCenterId,
      product_id: product.id,
      quantity_on_hand: runningStock,
      reorder_threshold: reorderThreshold,
      unit_code: unitCode,
    },
    { onConflict: 'organization_id,business_center_id,product_id' },
  );

  if (inventoryError) {
    throw new Error(`No se pudo guardar stock de "${productName}": ${inventoryError.message}`);
  }

  let loteFecha = parseFechaDdMmYyyy(row.lote_fecha);
  let expiresAt = parseFechaDdMmYyyy(row.fecha_vencimiento)?.isoDate ?? null;
  let lotCostCents = costPriceCents;
  let lotVendor = vendor;

  if (!loteFecha && tipoProducto === 'subproducto' && parentProductId) {
    const inherited = await resolveInheritedLot(
      row,
      context,
      parentName,
      parentProductId,
      businessCenterId,
    );
    if (inherited) {
      loteFecha = {
        isoDate: inherited.isoDate,
        lotCodeBase: inherited.lotCodeBase,
      };
      expiresAt = expiresAt ?? inherited.expiresAt;
      lotCostCents = lotCostCents ?? inherited.costPriceCents;
      lotVendor = lotVendor || inherited.vendor;
    }
  }

  if (loteFecha) {
    const lotCode = buildLotCode(loteFecha.lotCodeBase, product.sku, context.lotCounters);
    const existingLotId = await findExistingLot(product.id, businessCenterId, lotCode);

    if (!existingLotId) {
      const { error: lotError } = await supabase.from('inventory_lots').insert({
        organization_id: organizationId,
        business_center_id: businessCenterId,
        product_id: product.id,
        lot_code: lotCode,
        received_quantity: quantityOnHand,
        remaining_quantity: quantityOnHand,
        unit_code: unitCode,
        unit_cost_cents: lotCostCents,
        received_at: `${loteFecha.isoDate}T12:00:00.000Z`,
        expires_at: expiresAt,
        supplier_reference: lotVendor,
      });

      if (lotError) {
        throw new Error(`No se pudo crear lote de "${productName}": ${lotError.message}`);
      }
    }

    if (tipoProducto === 'producto') {
      context.latestLotByProductName.set(productName.toLowerCase(), {
        isoDate: loteFecha.isoDate,
        lotCodeBase: loteFecha.lotCodeBase,
        expiresAt,
        costPriceCents: lotCostCents,
        vendor: lotVendor,
        businessCenterId,
      });
    }
  }
}

const branchContext = await loadBusinessCenters();
const rows = parseCsv(readFileSync(filePath, 'utf8'));
const sortedRows = [...rows].sort((left, right) => {
    const leftType = parseTipoProducto(left.tipo_producto);
    const rightType = parseTipoProducto(right.tipo_producto);
    if (leftType === rightType) {
      return 0;
    }
    return leftType === 'producto' ? -1 : 1;
  });

const context = {
  ...branchContext,
  importedByName: new Map(),
  reservedSkus: new Set(),
  lotCounters: new Map(),
  stockTotals: new Map(),
  latestLotByProductName: new Map(),
  rowsByName: new Map(
    sortedRows.map((row) => [normalizeText(row.nombre_producto).toLowerCase(), row]),
  ),
};

for (const row of sortedRows) {
  await importRow(row, context);
  console.log(`Importado: ${row.nombre_producto} (${normalizeText(row.sucursal) || 'sucursal por defecto'})`);
}

console.log(`Listo. Se importaron ${sortedRows.length} filas.`);
