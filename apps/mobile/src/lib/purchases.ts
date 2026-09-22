import { dateInputToIsoDate, isoDateToDateInput } from './addStockForm';
import { getAppStorageItem, setAppStorageItem } from './appStorage';
import { formatMoneyInput } from './productEditForm';
import { purchaseLineId } from './purchaseLineId';
import {
  computePurchaseTotals,
  normalizeIvaRatePercent,
  type AdjustmentKind,
  type AdjustmentMode,
  type IvaRatePercent,
} from './purchaseTotals';
import { supabase } from './supabase';

const PURCHASES_STORAGE_KEY = 'baas_purchases_v2';
const LEGACY_PURCHASES_STORAGE_KEY = 'baas_purchases_v1';
const MIGRATED_FLAG_PREFIX = 'baas_purchases_migrated_v1.';

export type PurchaseStatus = 'pending_confirmation' | 'confirmed';

export type PurchaseLineRecord = {
  cost: string;
  expiresDate?: string;
  id: string;
  lineTotalCents: number;
  lotId?: string | null;
  marginPercent: string;
  previousBaseUnitCode?: string | null;
  previousMetadata?: Record<string, unknown> | null;
  previousUnitPriceCents?: number | null;
  productId: string;
  productName: string;
  quantity: number;
  unitCode: string;
  unitCostCents: number;
  unitPrice: string;
  unitPriceCents: number;
};

export type PurchaseRecord = {
  adjustmentCents: number;
  adjustmentKind: AdjustmentKind | null;
  adjustmentMode: AdjustmentMode | null;
  adjustmentValue: number;
  businessCenterId: string;
  createdAt: string;
  date: string;
  id: string;
  itemCount: number;
  ivaCents: number;
  ivaEnabled: boolean;
  ivaRatePercent: IvaRatePercent;
  lines: PurchaseLineRecord[];
  number: string;
  organizationId: string;
  status: PurchaseStatus;
  subtotalCents: number;
  supplier: string;
  /** Alias of totalCents for older call sites. */
  totalCostCents: number;
  totalCents: number;
  updatedAt: string;
};

type PurchaseRow = {
  adjustment_cents: number;
  adjustment_kind: string | null;
  adjustment_mode: string | null;
  adjustment_value: number | string;
  business_center_id: string;
  created_at: string;
  id: string;
  item_count: number;
  iva_cents: number;
  iva_enabled: boolean;
  iva_rate_percent: number | string;
  number: string;
  organization_id: string;
  purchase_date: string | null;
  status: string;
  subtotal_cents: number;
  supplier: string;
  total_cents: number;
  updated_at: string;
};

type PurchaseLineRow = {
  cost: string;
  expires_date: string | null;
  id: string;
  line_total_cents: number;
  lot_id: string | null;
  margin_percent: string;
  previous_base_unit_code: string | null;
  previous_metadata: Record<string, unknown> | null;
  previous_unit_price_cents: number | null;
  product_id: string;
  product_name: string;
  purchase_id: string;
  quantity: number | string;
  sort_order: number;
  unit_code: string;
  unit_cost_cents: number;
  unit_price: string;
  unit_price_cents: number;
};

function migratedFlagKey(organizationId: string, businessCenterId: string): string {
  return `${MIGRATED_FLAG_PREFIX}${organizationId}.${businessCenterId}`;
}

function normalizePurchaseNumber(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePurchaseStatus(value: unknown): PurchaseStatus {
  return value === 'confirmed' ? 'confirmed' : 'pending_confirmation';
}

function createPurchaseId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `PC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAdjustmentKind(value: unknown): AdjustmentKind | null {
  return value === 'discount' || value === 'surcharge' ? value : null;
}

function normalizeAdjustmentMode(value: unknown): AdjustmentMode | null {
  return value === 'percent' || value === 'fixed' ? value : null;
}

export function normalizeLine(
  raw: Partial<PurchaseLineRecord> & { productId: string },
): PurchaseLineRecord {
  const unitCostCents = raw.unitCostCents ?? 0;
  const unitPriceCents = raw.unitPriceCents ?? 0;
  const quantity = raw.quantity ?? 0;

  return {
    cost: raw.cost ?? formatMoneyInput(unitCostCents / 100),
    expiresDate: raw.expiresDate ?? '',
    id: raw.id ?? createPurchaseId(),
    lineTotalCents: raw.lineTotalCents ?? Math.max(0, quantity * unitCostCents),
    lotId: raw.lotId ?? null,
    marginPercent: raw.marginPercent ?? '0',
    previousBaseUnitCode: raw.previousBaseUnitCode ?? null,
    previousMetadata: raw.previousMetadata ?? null,
    previousUnitPriceCents: raw.previousUnitPriceCents ?? null,
    productId: raw.productId,
    productName: raw.productName ?? 'Producto',
    quantity,
    unitCode: raw.unitCode ?? 'unit',
    unitCostCents,
    unitPrice: raw.unitPrice ?? formatMoneyInput(unitPriceCents / 100),
    unitPriceCents,
  };
}

function lineSubtotalCents(lines: PurchaseLineRecord[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
}

function withComputedTotals(
  base: Omit<
    PurchaseRecord,
    | 'adjustmentCents'
    | 'ivaCents'
    | 'subtotalCents'
    | 'totalCents'
    | 'totalCostCents'
  > & {
    adjustmentCents?: number;
    ivaCents?: number;
    subtotalCents?: number;
    totalCents?: number;
    totalCostCents?: number;
  },
): PurchaseRecord {
  const totals = computePurchaseTotals({
    adjustmentKind: base.adjustmentKind,
    adjustmentMode: base.adjustmentMode,
    adjustmentValue: base.adjustmentValue,
    ivaEnabled: base.ivaEnabled,
    ivaRatePercent: base.ivaRatePercent,
    lineSubtotalCents: lineSubtotalCents(base.lines),
  });

  return {
    ...base,
    adjustmentCents: totals.adjustmentCents,
    ivaCents: totals.ivaCents,
    subtotalCents: totals.subtotalCents,
    totalCents: totals.totalCents,
    totalCostCents: totals.totalCents,
  };
}

export function normalizePurchase(
  raw: Partial<PurchaseRecord> & {
    businessCenterId: string;
    number: string;
    organizationId: string;
  },
): PurchaseRecord {
  const lines = Array.isArray(raw.lines) ? raw.lines.map((line) => normalizeLine(line)) : [];
  const createdAt = raw.createdAt ?? new Date().toISOString();

  return withComputedTotals({
    adjustmentKind: normalizeAdjustmentKind(raw.adjustmentKind),
    adjustmentMode: normalizeAdjustmentMode(raw.adjustmentMode),
    adjustmentValue:
      typeof raw.adjustmentValue === 'number' && Number.isFinite(raw.adjustmentValue)
        ? raw.adjustmentValue
        : 0,
    businessCenterId: raw.businessCenterId,
    createdAt,
    date: raw.date ?? '',
    id: raw.id ?? createPurchaseId(),
    itemCount: raw.itemCount ?? lines.reduce((sum, line) => sum + line.quantity, 0),
    ivaEnabled: Boolean(raw.ivaEnabled),
    ivaRatePercent: normalizeIvaRatePercent(raw.ivaRatePercent),
    lines,
    number: raw.number,
    organizationId: raw.organizationId,
    status: normalizePurchaseStatus(raw.status),
    supplier: raw.supplier ?? '',
    updatedAt: raw.updatedAt ?? createdAt,
  });
}

function rowToLine(row: PurchaseLineRow): PurchaseLineRecord {
  return normalizeLine({
    cost: row.cost,
    expiresDate: row.expires_date ?? '',
    id: row.id,
    lineTotalCents: row.line_total_cents,
    lotId: row.lot_id,
    marginPercent: row.margin_percent,
    previousBaseUnitCode: row.previous_base_unit_code,
    previousMetadata: row.previous_metadata,
    previousUnitPriceCents: row.previous_unit_price_cents,
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitCode: row.unit_code,
    unitCostCents: row.unit_cost_cents,
    unitPrice: row.unit_price,
    unitPriceCents: row.unit_price_cents,
  });
}

function rowToPurchase(row: PurchaseRow, lines: PurchaseLineRecord[]): PurchaseRecord {
  return normalizePurchase({
    adjustmentKind: normalizeAdjustmentKind(row.adjustment_kind),
    adjustmentMode: normalizeAdjustmentMode(row.adjustment_mode),
    adjustmentValue: Number(row.adjustment_value) || 0,
    businessCenterId: row.business_center_id,
    createdAt: row.created_at,
    date: isoDateToDateInput(row.purchase_date ?? ''),
    id: row.id,
    itemCount: row.item_count,
    ivaEnabled: row.iva_enabled,
    ivaRatePercent: normalizeIvaRatePercent(row.iva_rate_percent),
    lines,
    number: row.number,
    organizationId: row.organization_id,
    status: normalizePurchaseStatus(row.status),
    supplier: row.supplier ?? '',
    updatedAt: row.updated_at,
  });
}

function toStoredPurchaseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoDate = dateInputToIsoDate(trimmed);
  if (!isoDate) {
    throw new Error('Ingresá la fecha de compra en formato día/mes/año.');
  }

  return isoDate;
}

function purchaseToRow(purchase: PurchaseRecord) {
  return {
    adjustment_cents: purchase.adjustmentCents,
    adjustment_kind: purchase.adjustmentKind,
    adjustment_mode: purchase.adjustmentMode,
    adjustment_value: purchase.adjustmentValue,
    business_center_id: purchase.businessCenterId,
    item_count: purchase.itemCount,
    iva_cents: purchase.ivaCents,
    iva_enabled: purchase.ivaEnabled,
    iva_rate_percent: purchase.ivaRatePercent,
    number: purchase.number,
    organization_id: purchase.organizationId,
    purchase_date: toStoredPurchaseDate(purchase.date),
    status: purchase.status,
    subtotal_cents: purchase.subtotalCents,
    supplier: purchase.supplier,
    total_cents: purchase.totalCents,
  };
}

function linesToRows(purchaseId: string, organizationId: string, lines: PurchaseLineRecord[]) {
  return lines.map((line, index) => ({
    cost: line.cost,
    expires_date: line.expiresDate || null,
    id: purchaseLineId(line.id),
    line_total_cents: line.lineTotalCents,
    lot_id: line.lotId ?? null,
    margin_percent: line.marginPercent,
    organization_id: organizationId,
    previous_base_unit_code: line.previousBaseUnitCode ?? null,
    previous_metadata: line.previousMetadata ?? null,
    previous_unit_price_cents: line.previousUnitPriceCents ?? null,
    product_id: line.productId,
    product_name: line.productName,
    purchase_id: purchaseId,
    quantity: line.quantity,
    sort_order: index,
    unit_code: line.unitCode,
    unit_cost_cents: line.unitCostCents,
    unit_price: line.unitPrice,
    unit_price_cents: line.unitPriceCents,
  }));
}

export function purchaseStatusLabel(status: PurchaseStatus): string {
  return status === 'confirmed' ? 'Confirmada' : 'Pendiente de confirmación';
}

async function readLocalPurchases(): Promise<PurchaseRecord[]> {
  try {
    const raw = await getAppStorageItem(PURCHASES_STORAGE_KEY);
    const legacyRaw = raw ? null : await getAppStorageItem(LEGACY_PURCHASES_STORAGE_KEY);
    const source = raw ?? legacyRaw;

    if (!source) {
      return [];
    }

    const parsed = JSON.parse(source) as Array<Partial<PurchaseRecord>>;
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is Partial<PurchaseRecord> & {
              businessCenterId: string;
              number: string;
              organizationId: string;
            } =>
              typeof item?.businessCenterId === 'string' &&
              typeof item?.number === 'string' &&
              typeof item?.organizationId === 'string',
          )
          .map(normalizePurchase)
      : [];
  } catch {
    return [];
  }
}

async function replacePurchaseLines(
  purchaseId: string,
  organizationId: string,
  lines: PurchaseLineRecord[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('purchase_lines')
    .delete()
    .eq('purchase_id', purchaseId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (lines.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from('purchase_lines')
    .insert(linesToRows(purchaseId, organizationId, lines));

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function fetchLinesForPurchases(
  purchaseIds: string[],
): Promise<Map<string, PurchaseLineRecord[]>> {
  const map = new Map<string, PurchaseLineRecord[]>();
  if (purchaseIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from('purchase_lines')
    .select(
      'id, purchase_id, product_id, product_name, quantity, unit_code, unit_cost_cents, unit_price_cents, line_total_cents, cost, unit_price, margin_percent, expires_date, lot_id, previous_base_unit_code, previous_metadata, previous_unit_price_cents, sort_order',
    )
    .in('purchase_id', purchaseIds)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as PurchaseLineRow[]) {
    const list = map.get(row.purchase_id) ?? [];
    list.push(rowToLine(row));
    map.set(row.purchase_id, list);
  }

  return map;
}

async function migrateLocalPurchasesOnce(
  organizationId: string,
  businessCenterId: string,
): Promise<void> {
  const flag = await getAppStorageItem(migratedFlagKey(organizationId, businessCenterId));
  if (flag === '1') {
    return;
  }

  const local = (await readLocalPurchases()).filter(
    (purchase) =>
      purchase.organizationId === organizationId &&
      purchase.businessCenterId === businessCenterId,
  );

  for (const purchase of local) {
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('business_center_id', businessCenterId)
      .ilike('number', purchase.number)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { data: inserted, error } = await supabase
      .from('purchases')
      .insert(purchaseToRow(purchase))
      .select('id')
      .single<{ id: string }>();

    if (error || !inserted) {
      continue;
    }

    try {
      await replacePurchaseLines(inserted.id, organizationId, purchase.lines);
    } catch {
      // Keep migrating other purchases.
    }
  }

  await setAppStorageItem(migratedFlagKey(organizationId, businessCenterId), '1');
}

export async function listPurchases(
  organizationId: string,
  businessCenterId: string,
): Promise<PurchaseRecord[]> {
  await migrateLocalPurchasesOnce(organizationId, businessCenterId);

  const { data, error } = await supabase
    .from('purchases')
    .select(
      'id, organization_id, business_center_id, number, supplier, purchase_date, status, item_count, subtotal_cents, adjustment_kind, adjustment_mode, adjustment_value, adjustment_cents, iva_enabled, iva_rate_percent, iva_cents, total_cents, created_at, updated_at',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PurchaseRow[];
  const linesMap = await fetchLinesForPurchases(rows.map((row) => row.id));

  return rows.map((row) => rowToPurchase(row, linesMap.get(row.id) ?? []));
}

export async function getPurchaseById(options: {
  businessCenterId: string;
  organizationId: string;
  purchaseId: string;
}): Promise<PurchaseRecord | null> {
  await migrateLocalPurchasesOnce(options.organizationId, options.businessCenterId);

  const { data, error } = await supabase
    .from('purchases')
    .select(
      'id, organization_id, business_center_id, number, supplier, purchase_date, status, item_count, subtotal_cents, adjustment_kind, adjustment_mode, adjustment_value, adjustment_cents, iva_enabled, iva_rate_percent, iva_cents, total_cents, created_at, updated_at',
    )
    .eq('id', options.purchaseId)
    .eq('organization_id', options.organizationId)
    .eq('business_center_id', options.businessCenterId)
    .maybeSingle<PurchaseRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const linesMap = await fetchLinesForPurchases([data.id]);
  return rowToPurchase(data, linesMap.get(data.id) ?? []);
}

export async function isPurchaseNumberTaken(options: {
  businessCenterId: string;
  excludePurchaseId?: string;
  organizationId: string;
  purchaseNumber: string;
}): Promise<boolean> {
  const normalized = normalizePurchaseNumber(options.purchaseNumber);

  if (!normalized) {
    return false;
  }

  const matches = await findPurchasesByNumber({
    businessCenterId: options.businessCenterId,
    excludePurchaseId: options.excludePurchaseId,
    organizationId: options.organizationId,
    purchaseNumber: normalized,
  });

  if (matches.length === 0) {
    return false;
  }

  const { data: lines, error: linesError } = await supabase
    .from('purchase_lines')
    .select('purchase_id')
    .in(
      'purchase_id',
      matches.map((row) => row.id),
    )
    .limit(1);

  if (linesError) {
    throw new Error(linesError.message);
  }

  return (lines ?? []).length > 0;
}

async function findPurchasesByNumber(options: {
  businessCenterId: string;
  excludePurchaseId?: string;
  organizationId: string;
  purchaseNumber: string;
}): Promise<Array<{ id: string }>> {
  const normalized = normalizePurchaseNumber(options.purchaseNumber);

  if (!normalized) {
    return [];
  }

  const { data, error } = await supabase
    .from('purchases')
    .select('id, number')
    .eq('organization_id', options.organizationId)
    .eq('business_center_id', options.businessCenterId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).filter((row) => {
    if (options.excludePurchaseId && row.id === options.excludePurchaseId) {
      return false;
    }
    return normalizePurchaseNumber(row.number) === normalized;
  });
}

async function deleteEmptyPurchases(purchaseIds: string[]): Promise<void> {
  if (purchaseIds.length === 0) {
    return;
  }

  const { data: lines, error: linesError } = await supabase
    .from('purchase_lines')
    .select('purchase_id')
    .in('purchase_id', purchaseIds);

  if (linesError) {
    throw new Error(linesError.message);
  }

  const withLines = new Set((lines ?? []).map((line) => line.purchase_id));
  const emptyIds = purchaseIds.filter((id) => !withLines.has(id));

  if (emptyIds.length === 0) {
    return;
  }

  const { error } = await supabase.from('purchases').delete().in('id', emptyIds);

  if (error) {
    throw new Error(error.message);
  }
}

export async function registerPurchase(input: {
  adjustmentKind?: AdjustmentKind | null;
  adjustmentMode?: AdjustmentMode | null;
  adjustmentValue?: number;
  businessCenterId: string;
  date: string;
  itemCount: number;
  ivaEnabled?: boolean;
  ivaRatePercent?: number;
  lines: PurchaseLineRecord[];
  number: string;
  organizationId: string;
  status?: PurchaseStatus;
  supplier: string;
  totalCostCents?: number;
}): Promise<PurchaseRecord> {
  const number = input.number.trim();

  if (!number) {
    throw new Error('Ingresá el número de compra.');
  }

  const existing = await findPurchasesByNumber({
    businessCenterId: input.businessCenterId,
    organizationId: input.organizationId,
    purchaseNumber: number,
  });
  const taken = await isPurchaseNumberTaken({
    businessCenterId: input.businessCenterId,
    organizationId: input.organizationId,
    purchaseNumber: number,
  });

  if (taken) {
    throw new Error('Ese número de compra ya existe.');
  }

  await deleteEmptyPurchases(existing.map((row) => row.id));

  const record = normalizePurchase({
    adjustmentKind: input.adjustmentKind ?? null,
    adjustmentMode: input.adjustmentMode ?? null,
    adjustmentValue: input.adjustmentValue ?? 0,
    businessCenterId: input.businessCenterId,
    date: input.date,
    itemCount: input.itemCount,
    ivaEnabled: input.ivaEnabled ?? false,
    ivaRatePercent: normalizeIvaRatePercent(input.ivaRatePercent ?? 21),
    lines: input.lines,
    number,
    organizationId: input.organizationId,
    status: input.status ?? 'pending_confirmation',
    supplier: input.supplier.trim(),
  });

  const { data, error } = await supabase
    .from('purchases')
    .insert(purchaseToRow(record))
    .select(
      'id, organization_id, business_center_id, number, supplier, purchase_date, status, item_count, subtotal_cents, adjustment_kind, adjustment_mode, adjustment_value, adjustment_cents, iva_enabled, iva_rate_percent, iva_cents, total_cents, created_at, updated_at',
    )
    .single<PurchaseRow>();

  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo guardar la compra.');
  }

  try {
    await replacePurchaseLines(data.id, input.organizationId, record.lines);
  } catch (lineError) {
    await supabase.from('purchases').delete().eq('id', data.id);
    throw lineError;
  }

  const linesMap = await fetchLinesForPurchases([data.id]);
  return rowToPurchase(data, linesMap.get(data.id) ?? []);
}

export async function updatePurchase(options: {
  businessCenterId: string;
  organizationId: string;
  purchaseId: string;
  patch: Partial<
    Pick<
      PurchaseRecord,
      | 'adjustmentKind'
      | 'adjustmentMode'
      | 'adjustmentValue'
      | 'date'
      | 'itemCount'
      | 'ivaEnabled'
      | 'ivaRatePercent'
      | 'lines'
      | 'number'
      | 'status'
      | 'supplier'
      | 'totalCostCents'
    >
  >;
}): Promise<PurchaseRecord> {
  const current = await getPurchaseById(options);

  if (!current) {
    throw new Error('No se encontró la compra.');
  }

  if (options.patch.number && options.patch.number.trim() !== current.number) {
    const taken = await isPurchaseNumberTaken({
      businessCenterId: options.businessCenterId,
      excludePurchaseId: current.id,
      organizationId: options.organizationId,
      purchaseNumber: options.patch.number,
    });

    if (taken) {
      throw new Error('Ese número de compra ya existe.');
    }
  }

  const updated = normalizePurchase({
    ...current,
    ...options.patch,
    lines: options.patch.lines ?? current.lines,
    number: options.patch.number?.trim() || current.number,
    updatedAt: new Date().toISOString(),
  });

  const { data, error } = await supabase
    .from('purchases')
    .update(purchaseToRow(updated))
    .eq('id', options.purchaseId)
    .eq('organization_id', options.organizationId)
    .eq('business_center_id', options.businessCenterId)
    .select(
      'id, organization_id, business_center_id, number, supplier, purchase_date, status, item_count, subtotal_cents, adjustment_kind, adjustment_mode, adjustment_value, adjustment_cents, iva_enabled, iva_rate_percent, iva_cents, total_cents, created_at, updated_at',
    )
    .single<PurchaseRow>();

  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo actualizar la compra.');
  }

  if (options.patch.lines) {
    await replacePurchaseLines(options.purchaseId, options.organizationId, updated.lines);
  }

  const linesMap = await fetchLinesForPurchases([data.id]);
  return rowToPurchase(data, linesMap.get(data.id) ?? []);
}

export async function getOrganizationDefaultIvaRate(
  organizationId: string,
): Promise<IvaRatePercent> {
  const { data, error } = await supabase
    .from('organizations')
    .select('default_iva_rate_percent')
    .eq('id', organizationId)
    .maybeSingle<{ default_iva_rate_percent: number | string | null }>();

  if (error) {
    return 21;
  }

  return normalizeIvaRatePercent(data?.default_iva_rate_percent ?? 21);
}
