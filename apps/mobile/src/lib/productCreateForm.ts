import { formatDateInput } from './addStockForm';
import {
  applyCostToFormValues,
  applyMarginToFormValues,
  applyUnitPriceToFormValues,
  calculateMarginFromCostAndPrice,
  formatMoneyInput,
  formatPercentInput,
  parseMoneyInput,
  parsePercentInput,
} from './productEditForm';
import type { ProductStatusSlug } from './productCatalog';
import type { AddProductFormValues, Product } from '../types/products';

export function createEmptyAddProductForm(businessCenterId: string): AddProductFormValues {
  return {
    baseUnitCode: 'unit',
    baseUnitEquivalent: '',
    businessCenterId,
    category: '',
    cost: '0.00',
    description: '',
    expiresDate: '',
    marginPercent: '0',
    name: '',
    parentProductId: '',
    productType: 'producto',
    receivedDate: formatDateInput(new Date()),
    reorderThreshold: '5',
    status: 'en_stock',
    stockQuantity: '0',
    supplier: '',
    unitPrice: '0.00',
  };
}

export function createEmptyAddSubproductForm(
  parentProduct: Product,
  businessCenterId: string,
): AddProductFormValues {
  const supplier =
    typeof parentProduct.metadata.proveedor === 'string' ? parentProduct.metadata.proveedor : '';

  return {
    ...createEmptyAddProductForm(businessCenterId),
    category: parentProduct.category ?? '',
    parentProductId: parentProduct.id,
    productType: 'subproducto',
    supplier,
  };
}

function readProductCost(product: Product): number {
  const costCents =
    typeof product.metadata.precio_costo_cents === 'number'
      ? product.metadata.precio_costo_cents
      : 0;

  return costCents / 100;
}

export function scalePricingFromParentProduct(
  parentProduct: Product,
  equivalentRaw: string,
): Pick<AddProductFormValues, 'cost' | 'marginPercent' | 'unitPrice'> {
  const equivalent = Number.parseFloat(equivalentRaw.replace(',', '.'));

  if (!Number.isFinite(equivalent) || equivalent <= 0) {
    return {
      cost: '0.00',
      marginPercent: '0',
      unitPrice: '0.00',
    };
  }

  const cost = readProductCost(parentProduct) * equivalent;
  const price = (parentProduct.unitPriceCents / 100) * equivalent;
  const margin = calculateMarginFromCostAndPrice(cost, price);

  return {
    cost: formatMoneyInput(cost),
    marginPercent: formatPercentInput(margin),
    unitPrice: formatMoneyInput(price),
  };
}

export function applyAddProductCost(values: AddProductFormValues): AddProductFormValues {
  return applyCostToFormValues(values) as AddProductFormValues;
}

export function applyAddProductMargin(values: AddProductFormValues): AddProductFormValues {
  return applyMarginToFormValues(values) as AddProductFormValues;
}

export function applyAddProductUnitPrice(values: AddProductFormValues): AddProductFormValues {
  return applyUnitPriceToFormValues(values) as AddProductFormValues;
}

export function parseBaseUnitEquivalent(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');

  if (!trimmed) {
    return null;
  }

  const amount = Number.parseFloat(trimmed);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

export function validateAddProductForm(values: AddProductFormValues): string | null {
  if (values.name.trim().length === 0) {
    return 'El nombre del producto es obligatorio.';
  }

  if (values.category.trim().length === 0) {
    return 'Ingresa una categoria.';
  }

  const stockQuantity = Number.parseInt(values.stockQuantity.trim(), 10);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    return 'Ingresa una cantidad de stock valida.';
  }

  const reorderThreshold = Number.parseInt(values.reorderThreshold.trim(), 10);
  if (!Number.isInteger(reorderThreshold) || reorderThreshold < 0) {
    return 'Ingresa un umbral de reorden valido.';
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

  if (stockQuantity > 0 && values.receivedDate.trim().length === 0) {
    return 'Ingresa la fecha del lote inicial.';
  }

  return null;
}

export function validateAddSubproductForm(values: AddProductFormValues): string | null {
  if (!values.parentProductId.trim()) {
    return 'No se encontro el producto base.';
  }

  if (parseBaseUnitEquivalent(values.baseUnitEquivalent) === null) {
    return 'Ingresa la equivalencia con el producto base.';
  }

  return validateAddProductForm({
    ...values,
    productType: 'subproducto',
  });
}

export function readParentProductFromCatalog(
  products: Product[],
  parentProductId: string,
): Product | null {
  return products.find((product) => product.id === parentProductId) ?? null;
}

export function getDefaultStatusForCreate(): ProductStatusSlug {
  return 'en_stock';
}
