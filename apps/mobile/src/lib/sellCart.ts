import type { Product } from '../types/products';
import { getAppStorageItem, removeAppStorageItem, setAppStorageItem } from './appStorage';
import { supabase } from './supabase';

const QUOTES_STORAGE_KEY = 'baas_sell_quotes_v1';
const QUOTES_MIGRATED_KEY = 'baas_sell_quotes_migrated_v1';

export type SellDiscountMode = 'amount' | 'percent';

export type SellCartLine = {
  id: string;
  name: string;
  productId: string;
  quantity: number;
  soldByWeight: boolean;
  unitPriceCents: number;
  weightGramsInput: string | null;
};

export type SellCheckoutDraft = {
  cart: SellCartLine[];
  clientLabel: string;
  discountMode: SellDiscountMode;
  discountValue: number;
  paymentMethod: 'efectivo';
  receiptLabel: string;
};

/** Presupuesto lifecycle for Argentine SMB billing flows. */
export type SellQuoteStatus =
  | 'guardado'
  | 'enviado'
  | 'aceptado'
  | 'cobrado'
  | 'cancelado'
  | 'vencido';

export type SavedSellQuote = {
  createdAt: string;
  draft: SellCheckoutDraft;
  id: string;
  status: SellQuoteStatus;
  updatedAt: string;
};

type SellQuoteRow = {
  created_at: string;
  draft: SellCheckoutDraft;
  id: string;
  status: SellQuoteStatus;
  updated_at: string;
};

export const SELL_QUOTE_STATUS_LABELS: Record<SellQuoteStatus, string> = {
  aceptado: 'Aceptado',
  cancelado: 'Cancelado',
  cobrado: 'Cobrado',
  enviado: 'Enviado',
  guardado: 'Guardado',
  vencido: 'Vencido',
};

export const SELL_QUOTE_STATUS_ORDER: SellQuoteStatus[] = [
  'guardado',
  'enviado',
  'aceptado',
  'cobrado',
  'cancelado',
  'vencido',
];

export const DEFAULT_FIELD_VALUE = 'Estandar';
export const DEFAULT_CLIENT_LABEL = DEFAULT_FIELD_VALUE;
export const DEFAULT_RECEIPT_LABEL = DEFAULT_FIELD_VALUE;
export const DEFAULT_PAYMENT_METHOD = 'efectivo' as const;
export const WEIGHT_GRAMS_PLACEHOLDER = 1000;

export function isSoldByWeight(product: Product): boolean {
  const unit = product.unitCode ?? product.baseUnitCode ?? 'unit';
  return unit === 'kg' && product.parentProductId == null;
}

export function createCartLineFromProduct(product: Product): SellCartLine {
  const soldByWeight = isSoldByWeight(product);

  return {
    id: `${product.id}-${Date.now()}`,
    name: product.name,
    productId: product.id,
    quantity: soldByWeight ? 1 : 1,
    soldByWeight,
    unitPriceCents: product.unitPriceCents,
    weightGramsInput: null,
  };
}

export function getEffectiveGrams(line: SellCartLine): number {
  if (!line.soldByWeight) {
    return line.quantity;
  }

  if (line.weightGramsInput === null) {
    return WEIGHT_GRAMS_PLACEHOLDER;
  }

  return parseGramsInput(line.weightGramsInput);
}

/** Quantity to deduct from inventory (kg for weight products, units otherwise). */
export function getCartLineSoldQuantity(line: SellCartLine): number {
  if (line.soldByWeight) {
    return getEffectiveGrams(line) / 1000;
  }

  return line.quantity;
}

export function buildSaleMovementNote(line: SellCartLine, unitCode: string, clientLabel: string): string {
  if (line.soldByWeight) {
    const grams = getEffectiveGrams(line);
    return `Venta POS • ${grams} g • ${clientLabel}`;
  }

  return `Venta POS • ${line.quantity} ${unitCode} • ${clientLabel}`;
}

export function getCartLineSubtotalCents(line: SellCartLine): number {
  if (line.soldByWeight) {
    const grams = getEffectiveGrams(line);
    return Math.round((line.unitPriceCents * grams) / 1000);
  }

  return line.unitPriceCents * line.quantity;
}

export function computeCartSubtotalCents(cart: SellCartLine[]): number {
  return cart.reduce((sum, line) => sum + getCartLineSubtotalCents(line), 0);
}

export function computeDiscountCents(
  subtotalCents: number,
  discountMode: SellDiscountMode,
  discountValue: number,
): number {
  if (subtotalCents <= 0 || discountValue <= 0) {
    return 0;
  }

  if (discountMode === 'percent') {
    return Math.min(subtotalCents, Math.round((subtotalCents * discountValue) / 100));
  }

  return Math.min(subtotalCents, Math.round(discountValue * 100));
}

export function computeSaleTotalCents(
  subtotalCents: number,
  discountMode: SellDiscountMode,
  discountValue: number,
): number {
  return Math.max(0, subtotalCents - computeDiscountCents(subtotalCents, discountMode, discountValue));
}

export function formatCurrency(cents: number): string {
  const amount = cents / 100;
  const formatted = amount.toLocaleString('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  return `$${formatted}`;
}

export function formatSignedCurrency(cents: number): string {
  if (cents === 0) {
    return '$0,00';
  }

  return `-${formatCurrency(cents)}`;
}

export function formatUnitQuantity(quantity: number): string {
  return `${quantity} u`;
}

export function parseDiscountInput(value: string): number {
  const trimmed = value.trim().replace(',', '.');

  if (!trimmed) {
    return 0;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parseGramsInput(value: string): number {
  const digits = value.replace(/[^\d]/g, '');

  if (!digits) {
    return 0;
  }

  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function mergeCartLine(cart: SellCartLine[], line: SellCartLine): SellCartLine[] {
  const existingIndex = cart.findIndex(
    (item) => item.productId === line.productId && item.soldByWeight === line.soldByWeight,
  );

  if (existingIndex === -1) {
    return [...cart, line];
  }

  const existing = cart[existingIndex];
  const next = [...cart];
  const mergedQuantity = existing.soldByWeight
    ? getEffectiveGrams(existing) + getEffectiveGrams(line)
    : existing.quantity + line.quantity;

  next[existingIndex] = {
    ...existing,
    quantity: existing.soldByWeight ? 1 : mergedQuantity,
    unitPriceCents: line.unitPriceCents,
    weightGramsInput: existing.soldByWeight ? String(mergedQuantity) : existing.weightGramsInput,
  };

  return next;
}

export function buildCheckoutDraft(
  cart: SellCartLine[],
  discountMode: SellDiscountMode,
  discountInput: string,
): SellCheckoutDraft {
  return {
    cart,
    clientLabel: DEFAULT_CLIENT_LABEL,
    discountMode,
    discountValue: parseDiscountInput(discountInput),
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    receiptLabel: DEFAULT_RECEIPT_LABEL,
  };
}

function isSellQuoteStatus(value: unknown): value is SellQuoteStatus {
  return (
    value === 'enviado' ||
    value === 'aceptado' ||
    value === 'cobrado' ||
    value === 'cancelado' ||
    value === 'vencido' ||
    value === 'guardado'
  );
}

function normalizeSavedQuote(
  raw: Partial<SavedSellQuote> & { draft?: SellCheckoutDraft; id?: string },
): SavedSellQuote | null {
  if (!raw.id || !raw.draft || !Array.isArray(raw.draft.cart)) {
    return null;
  }

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
  const status = isSellQuoteStatus(raw.status) ? raw.status : 'guardado';

  return {
    createdAt,
    draft: raw.draft,
    id: raw.id,
    status,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
  };
}

function mapSellQuoteRow(row: SellQuoteRow): SavedSellQuote | null {
  return normalizeSavedQuote({
    createdAt: row.created_at,
    draft: row.draft,
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at,
  });
}

async function readLocalSavedQuotes(): Promise<SavedSellQuote[]> {
  try {
    const raw = await getAppStorageItem(QUOTES_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Array<Partial<SavedSellQuote> & { draft?: SellCheckoutDraft; id?: string }>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeSavedQuote)
      .filter((quote): quote is SavedSellQuote => quote != null);
  } catch {
    return [];
  }
}

/** One-time upload of device-local presupuestos into Supabase for this center. */
export async function migrateLocalSellQuotesIfNeeded(
  organizationId: string,
  businessCenterId: string,
): Promise<void> {
  const migratedFlag = await getAppStorageItem(QUOTES_MIGRATED_KEY);
  if (migratedFlag === '1') {
    return;
  }

  const localQuotes = await readLocalSavedQuotes();
  if (localQuotes.length === 0) {
    await setAppStorageItem(QUOTES_MIGRATED_KEY, '1');
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = localQuotes.map((quote) => ({
    business_center_id: businessCenterId,
    created_at: quote.createdAt,
    created_by: user?.id ?? null,
    draft: quote.draft,
    id: quote.id,
    organization_id: organizationId,
    status: quote.status,
    updated_at: quote.updatedAt,
  }));

  const { error } = await supabase.from('sell_quotes').upsert(rows, {
    ignoreDuplicates: true,
    onConflict: 'id',
  });

  if (error) {
    throw new Error(error.message);
  }

  await setAppStorageItem(QUOTES_MIGRATED_KEY, '1');
  await removeAppStorageItem(QUOTES_STORAGE_KEY);
}

export async function listSellQuotes(
  organizationId: string,
  businessCenterId: string,
): Promise<SavedSellQuote[]> {
  await migrateLocalSellQuotesIfNeeded(organizationId, businessCenterId);

  const { data, error } = await supabase
    .from('sell_quotes')
    .select('id, status, draft, created_at, updated_at')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as SellQuoteRow[])
    .map(mapSellQuoteRow)
    .filter((quote): quote is SavedSellQuote => quote != null);
}

export function getSellQuoteTotalCents(quote: SavedSellQuote): number {
  const subtotalCents = computeCartSubtotalCents(quote.draft.cart);
  return computeSaleTotalCents(subtotalCents, quote.draft.discountMode, quote.draft.discountValue);
}

export async function updateSellQuoteStatus(
  organizationId: string,
  businessCenterId: string,
  quoteId: string,
  status: SellQuoteStatus,
): Promise<SavedSellQuote | null> {
  const { data, error } = await supabase
    .from('sell_quotes')
    .update({ status })
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('id', quoteId)
    .select('id, status, draft, created_at, updated_at')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapSellQuoteRow(data as SellQuoteRow);
}

export async function saveSellQuote(
  organizationId: string,
  businessCenterId: string,
  draft: SellCheckoutDraft,
): Promise<string> {
  const now = new Date().toISOString();
  const id = `PRES-${Date.now().toString(36).toUpperCase()}`;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('sell_quotes').insert({
    business_center_id: businessCenterId,
    created_at: now,
    created_by: user?.id ?? null,
    draft,
    id,
    organization_id: organizationId,
    status: 'guardado',
    updated_at: now,
  });

  if (error) {
    throw new Error(error.message);
  }

  return id;
}
