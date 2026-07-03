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
  const headers = headerLine.split(',').map((value) => value.trim());

  return dataLines.map((line) => {
    const values = line.split(',').map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

const organizationId = readArg('--organization-id');
const businessCenterId = readArg('--business-center-id');
const filePath = readArg('--file');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!organizationId || !businessCenterId || !filePath || !supabaseUrl || !serviceRoleKey) {
  console.error(
    'Usage: node scripts/import-stock-csv.mjs --organization-id <uuid> --business-center-id <uuid> --file <path.csv>\nRequires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function importRow(row) {
  const sku = row.sku?.trim();
  const productName = row.product_name?.trim();
  if (!sku || !productName) {
    throw new Error(`Invalid row: missing sku or product_name (${JSON.stringify(row)})`);
  }

  const unitPriceCents = Math.round(Number.parseFloat(row.unit_price_ars || '0') * 100);
  const quantityOnHand = Number.parseFloat(row.quantity_on_hand || '0');
  const reorderThreshold = Number.parseFloat(row.reorder_threshold || '0');
  const unitCode = row.unit_code?.trim() || 'unit';

  const { data: product, error: productError } = await supabase
    .from('products')
    .upsert(
      {
        organization_id: organizationId,
        sku,
        name: productName,
        description: row.description?.trim() || null,
        unit_price_cents: unitPriceCents,
        currency: 'ARS',
        stock_quantity: Math.round(quantityOnHand),
        reorder_threshold: Math.round(reorderThreshold),
        base_unit_code: unitCode,
        pricing_unit_code: unitCode,
        is_active: true,
      },
      { onConflict: 'organization_id,sku' },
    )
    .select('id')
    .single();

  if (productError) {
    throw new Error(`Product upsert failed for ${sku}: ${productError.message}`);
  }

  const { error: inventoryError } = await supabase.from('inventory_items').upsert(
    {
      organization_id: organizationId,
      business_center_id: businessCenterId,
      product_id: product.id,
      quantity_on_hand: quantityOnHand,
      reorder_threshold: reorderThreshold,
      unit_code: unitCode,
    },
    { onConflict: 'organization_id,business_center_id,product_id' },
  );

  if (inventoryError) {
    throw new Error(`Inventory upsert failed for ${sku}: ${inventoryError.message}`);
  }

  const lotCode = row.lot_code?.trim();
  if (lotCode) {
    const { error: lotError } = await supabase.from('inventory_lots').insert({
      organization_id: organizationId,
      business_center_id: businessCenterId,
      product_id: product.id,
      lot_code: lotCode,
      received_quantity: quantityOnHand,
      remaining_quantity: quantityOnHand,
      unit_code: unitCode,
      expires_at: row.expires_at?.trim() || null,
    });

    if (lotError) {
      throw new Error(`Lot insert failed for ${sku}: ${lotError.message}`);
    }
  }
}

const rows = parseCsv(readFileSync(filePath, 'utf8'));

for (const row of rows) {
  await importRow(row);
  console.log(`Imported ${row.sku}`);
}

console.log(`Done. Imported ${rows.length} rows.`);
