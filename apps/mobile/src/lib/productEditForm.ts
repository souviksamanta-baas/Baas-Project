import {
  getProductStatusLabelFromSlug,
  normalizeBaseUnitCode,
  readProductStatusSlug,
  type ProductStatusSlug,
} from './productCatalog';
import type { Product, ProductEditFormValues } from '../types/products';

export function calculatePriceFromCostAndMargin(cost: number, marginPercent: number): number {
  return cost * (1 + marginPercent / 100);
}

export function calculateMarginFromCostAndPrice(cost: number, price: number): number {
  if (cost <= 0) {
    return 0;
  }

  return ((price - cost) / cost) * 100;
}

export function formatMoneyInput(value: number): string {
  return value.toFixed(2);
}

export function formatPercentInput(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return null;
  }

  return Number.parseFloat(trimmed);
}

export function parsePercentInput(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return null;
  }

  return Number.parseFloat(trimmed);
}

export function productToEditFormValues(
  product: Product,
  businessCenterId: string,
): ProductEditFormValues {
  const costCents =
    typeof product.metadata.precio_costo_cents === 'number'
      ? product.metadata.precio_costo_cents
      : 0;
  const cost = costCents / 100;
  const price = product.unitPriceCents / 100;
  const storedMargin =
    typeof product.metadata.margen_pct === 'number' ? product.metadata.margen_pct : null;
  const margin = storedMargin ?? calculateMarginFromCostAndPrice(cost, price);

  return {
    baseUnitCode: normalizeBaseUnitCode(product.baseUnitCode ?? product.unitCode),
    businessCenterId,
    category: product.category ?? '',
    cost: formatMoneyInput(cost),
    description: product.description ?? '',
    marginPercent: formatPercentInput(margin),
    name: product.name,
    status: readProductStatusSlug(product),
    unitPrice: formatMoneyInput(price),
  };
}

export function applyMarginToFormValues(values: ProductEditFormValues): ProductEditFormValues {
  const cost = parseMoneyInput(values.cost);
  const marginPercent = parsePercentInput(values.marginPercent);

  if (cost === null || marginPercent === null) {
    return values;
  }

  return {
    ...values,
    unitPrice: formatMoneyInput(calculatePriceFromCostAndMargin(cost, marginPercent)),
  };
}

export function applyUnitPriceToFormValues(values: ProductEditFormValues): ProductEditFormValues {
  const cost = parseMoneyInput(values.cost);
  const unitPrice = parseMoneyInput(values.unitPrice);

  if (cost === null || unitPrice === null) {
    return values;
  }

  return {
    ...values,
    marginPercent: formatPercentInput(calculateMarginFromCostAndPrice(cost, unitPrice)),
  };
}

export function applyCostToFormValues(values: ProductEditFormValues): ProductEditFormValues {
  const cost = parseMoneyInput(values.cost);
  const marginPercent = parsePercentInput(values.marginPercent);
  const unitPrice = parseMoneyInput(values.unitPrice);

  if (cost === null) {
    return values;
  }

  if (marginPercent !== null) {
    return {
      ...values,
      unitPrice: formatMoneyInput(calculatePriceFromCostAndMargin(cost, marginPercent)),
    };
  }

  if (unitPrice !== null) {
    return {
      ...values,
      marginPercent: formatPercentInput(calculateMarginFromCostAndPrice(cost, unitPrice)),
    };
  }

  return values;
}

export function validateProductEditForm(values: ProductEditFormValues): string | null {
  if (values.name.trim().length === 0) {
    return 'El nombre del producto es obligatorio.';
  }

  if (values.category.trim().length === 0) {
    return 'Selecciona una categoria.';
  }

  const cost = parseMoneyInput(values.cost);
  if (cost === null || cost < 0) {
    return 'Ingresa un costo valido.';
  }

  const unitPrice = parseMoneyInput(values.unitPrice);
  if (unitPrice === null || unitPrice < 0) {
    return 'Ingresa un precio de venta valido.';
  }

  const marginPercent = parsePercentInput(values.marginPercent);
  if (marginPercent === null || marginPercent < 0) {
    return 'Ingresa un margen valido.';
  }

  return null;
}

export function getStatusDisplayLabel(status: ProductStatusSlug): string {
  return getProductStatusLabelFromSlug(status);
}
