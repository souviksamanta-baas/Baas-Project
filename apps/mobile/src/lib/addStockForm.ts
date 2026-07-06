import {
  calculateMarginFromCostAndPrice,
  calculatePriceFromCostAndMargin,
  formatMoneyInput,
  formatPercentInput,
  parseMoneyInput,
  parsePercentInput,
} from './productEditForm';
import { readSubproductBaseEquivalent } from './productCatalog';
import type { Product } from '../types/products';
import type { AddStockFormValues } from '../types/inventoryLots';

export function formatDateInput(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function dateInputToIso(value: string): string | null {
  const date = parseDateInput(value);
  if (!date) {
    return null;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T12:00:00.000Z`;
}

export function buildLotCodeBase(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `LOT-${year}${month}${day}`;
}

export function buildNextLotCode(baseCode: string, existingCodes: string[]): string {
  const prefix = `${baseCode}`;
  const matching = existingCodes.filter(
    (code) => code === prefix || code.startsWith(`${prefix}-`),
  );

  if (matching.length === 0) {
    return prefix;
  }

  return `${prefix}-${String(matching.length + 1).padStart(2, '0')}`;
}

function readProductCost(product: Product): number {
  const costCents =
    typeof product.metadata.precio_costo_cents === 'number'
      ? product.metadata.precio_costo_cents
      : 0;

  return costCents / 100;
}

function readProductSupplier(product: Product): string {
  return typeof product.metadata.proveedor === 'string' ? product.metadata.proveedor : '';
}

function scalePricingFromParent(
  parentProduct: Product,
  subproduct: Product,
): Pick<AddStockFormValues, 'cost' | 'marginPercent' | 'unitPrice'> {
  const equivalent = readSubproductBaseEquivalent(subproduct) ?? 1;
  const cost = readProductCost(parentProduct) * equivalent;
  const price = (parentProduct.unitPriceCents / 100) * equivalent;
  const margin = calculateMarginFromCostAndPrice(cost, price);

  return {
    cost: formatMoneyInput(cost),
    marginPercent: formatPercentInput(margin),
    unitPrice: formatMoneyInput(price),
  };
}

function pricingFromProduct(product: Product): Pick<AddStockFormValues, 'cost' | 'marginPercent' | 'unitPrice'> {
  const cost = readProductCost(product);
  const price = product.unitPriceCents / 100;
  const storedMargin =
    typeof product.metadata.margen_pct === 'number' ? product.metadata.margen_pct : null;
  const margin = storedMargin ?? calculateMarginFromCostAndPrice(cost, price);

  return {
    cost: formatMoneyInput(cost),
    marginPercent: formatPercentInput(margin),
    unitPrice: formatMoneyInput(price),
  };
}

export function productToAddStockFormValues(
  product: Product,
  targetProductId: string,
  parentProduct?: Product | null,
): AddStockFormValues {
  const isSubproduct = product.parentProductId != null;
  const pricing =
    isSubproduct && parentProduct
      ? scalePricingFromParent(parentProduct, product)
      : pricingFromProduct(product);

  return {
    ...pricing,
    quantity: '',
    receivedDate: formatDateInput(new Date()),
    supplier: isSubproduct && parentProduct ? readProductSupplier(parentProduct) : readProductSupplier(product),
    targetProductId,
    unitCode: product.unitCode ?? product.baseUnitCode ?? 'unit',
  };
}

export function applyAddStockCost(values: AddStockFormValues, cost: string): AddStockFormValues {
  const parsedCost = parseMoneyInput(cost);
  const marginPercent = parsePercentInput(values.marginPercent);
  const unitPrice = parseMoneyInput(values.unitPrice);

  if (parsedCost === null) {
    return { ...values, cost };
  }

  if (marginPercent !== null) {
    return {
      ...values,
      cost,
      unitPrice: formatMoneyInput(calculatePriceFromCostAndMargin(parsedCost, marginPercent)),
    };
  }

  if (unitPrice !== null) {
    return {
      ...values,
      cost,
      marginPercent: formatPercentInput(calculateMarginFromCostAndPrice(parsedCost, unitPrice)),
    };
  }

  return { ...values, cost };
}

export function applyAddStockUnitPrice(
  values: AddStockFormValues,
  unitPrice: string,
): AddStockFormValues {
  const cost = parseMoneyInput(values.cost);
  const parsedUnitPrice = parseMoneyInput(unitPrice);

  if (cost === null || parsedUnitPrice === null) {
    return { ...values, unitPrice };
  }

  return {
    ...values,
    marginPercent: formatPercentInput(calculateMarginFromCostAndPrice(cost, parsedUnitPrice)),
    unitPrice,
  };
}

export function applyAddStockMargin(
  values: AddStockFormValues,
  marginPercent: string,
): AddStockFormValues {
  const cost = parseMoneyInput(values.cost);
  const parsedMargin = parsePercentInput(marginPercent);

  if (cost === null || parsedMargin === null) {
    return { ...values, marginPercent };
  }

  return {
    ...values,
    marginPercent,
    unitPrice: formatMoneyInput(calculatePriceFromCostAndMargin(cost, parsedMargin)),
  };
}

export function validateAddStockForm(values: AddStockFormValues): string | null {
  const quantity = Number.parseInt(values.quantity.trim(), 10);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return 'Ingresa una cantidad entera mayor a cero.';
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

  if (!parseDateInput(values.receivedDate)) {
    return 'Ingresa una fecha valida en formato dia/mes/año.';
  }

  return null;
}

export function previewLotCode(receivedDate: string, existingCodes: string[]): string {
  const date = parseDateInput(receivedDate) ?? new Date();
  return buildNextLotCode(buildLotCodeBase(date), existingCodes);
}
