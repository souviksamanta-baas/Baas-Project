import type { Product } from '../types/products';
import { getAppStorageItem, setAppStorageItem } from './appStorage';

const QUOTES_STORAGE_KEY = 'baas_sell_quotes_v1';

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

function normalizeSavedQuote(raw: Partial<SavedSellQuote> & { draft?: SellCheckoutDraft; id?: string }): SavedSellQuote | null {
  if (!raw.id || !raw.draft || !Array.isArray(raw.draft.cart)) {
    return null;
  }

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
  const status =
    raw.status === 'enviado' ||
    raw.status === 'aceptado' ||
    raw.status === 'cobrado' ||
    raw.status === 'cancelado' ||
    raw.status === 'vencido' ||
    raw.status === 'guardado'
      ? raw.status
      : 'guardado';

  return {
    createdAt,
    draft: raw.draft,
    id: raw.id,
    status,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
  };
}

async function readSavedQuotes(): Promise<SavedSellQuote[]> {
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

export async function listSellQuotes(): Promise<SavedSellQuote[]> {
  return readSavedQuotes();
}

export function getSellQuoteTotalCents(quote: SavedSellQuote): number {
  const subtotalCents = computeCartSubtotalCents(quote.draft.cart);
  return computeSaleTotalCents(subtotalCents, quote.draft.discountMode, quote.draft.discountValue);
}

export async function updateSellQuoteStatus(
  quoteId: string,
  status: SellQuoteStatus,
): Promise<SavedSellQuote | null> {
  const existing = await readSavedQuotes();
  const index = existing.findIndex((quote) => quote.id === quoteId);

  if (index < 0) {
    return null;
  }

  const updated: SavedSellQuote = {
    ...existing[index]!,
    status,
    updatedAt: new Date().toISOString(),
  };
  const next = [...existing];
  next[index] = updated;
  await setAppStorageItem(QUOTES_STORAGE_KEY, JSON.stringify(next));

  return updated;
}

export async function saveSellQuote(draft: SellCheckoutDraft): Promise<string> {
  const now = new Date().toISOString();
  const id = `PRES-${Date.now().toString(36).toUpperCase()}`;
  const quote: SavedSellQuote = {
    createdAt: now,
    draft,
    id,
    status: 'guardado',
    updatedAt: now,
  };
  const existing = await readSavedQuotes();

  await setAppStorageItem(QUOTES_STORAGE_KEY, JSON.stringify([quote, ...existing]));

  return id;
}
