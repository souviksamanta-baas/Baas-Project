import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Product } from '../types/products';

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

export type SavedSellQuote = {
  createdAt: string;
  draft: SellCheckoutDraft;
  id: string;
};

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

async function readSavedQuotes(): Promise<SavedSellQuote[]> {
  try {
    const raw = await AsyncStorage.getItem(QUOTES_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SavedSellQuote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSellQuote(draft: SellCheckoutDraft): Promise<string> {
  const id = `PRES-${Date.now().toString(36).toUpperCase()}`;
  const quote: SavedSellQuote = {
    createdAt: new Date().toISOString(),
    draft,
    id,
  };
  const existing = await readSavedQuotes();

  await AsyncStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify([quote, ...existing]));

  return id;
}
