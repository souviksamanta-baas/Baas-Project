import type { Product } from '../types/products';

export type ProductStatusSlug =
  | 'archivado'
  | 'descontinuado'
  | 'en_stock'
  | 'por_crear'
  | 'sin_stock';

export interface CatalogOption<T extends string = string> {
  label: string;
  value: T;
}

/** Dropdown options sorted A–Z by label (Spanish locale). */
export const PRODUCT_STATUS_OPTIONS: CatalogOption<ProductStatusSlug>[] = sortOptionsAlphabetically([
  { label: 'Archivado', value: 'archivado' },
  { label: 'Descontinuado', value: 'descontinuado' },
  { label: 'En stock', value: 'en_stock' },
  { label: 'Por crear', value: 'por_crear' },
  { label: 'Sin stock', value: 'sin_stock' },
]);

export const BASE_UNIT_OPTIONS: CatalogOption[] = sortOptionsAlphabetically([
  { label: 'Botella', value: 'botella' },
  { label: 'Kilo', value: 'kg' },
  { label: 'Lata', value: 'lata' },
  { label: 'Paquete', value: 'paquete' },
]);

export type ProductCodeTypeSlug = 'codigo_de_barras' | 'qr';

const PRODUCT_CODE_TYPE_LABELS: Record<ProductCodeTypeSlug, string> = {
  codigo_de_barras: 'Codigo de barras',
  qr: 'Codigo QR',
};

const UNIT_DISPLAY_LABELS: Record<string, { plural: string; singular: string }> = {
  botella: { plural: 'botellas', singular: 'botella' },
  kg: { plural: 'kilos', singular: 'kilo' },
  lata: { plural: 'latas', singular: 'lata' },
  paquete: { plural: 'paquetes', singular: 'paquete' },
  unit: { plural: 'unidades', singular: 'unidad' },
};

export function sortOptionsAlphabetically<T extends string>(
  options: CatalogOption<T>[],
): CatalogOption<T>[] {
  return [...options].sort((left, right) => left.label.localeCompare(right.label, 'es'));
}

export function collectCategoryOptions(
  products: Product[],
  currentCategory?: string | null,
): string[] {
  const categories = new Set<string>();

  for (const product of products) {
    const category = product.category?.trim();
    if (category) {
      categories.add(category);
    }
  }

  const trimmedCurrent = currentCategory?.trim();
  if (trimmedCurrent) {
    categories.add(trimmedCurrent);
  }

  return [...categories].sort((left, right) => left.localeCompare(right, 'es'));
}

export function collectSupplierOptions(
  products: Product[],
  currentSupplier?: string | null,
): string[] {
  const suppliers = new Set<string>();

  for (const product of products) {
    const supplier =
      typeof product.metadata.proveedor === 'string' ? product.metadata.proveedor.trim() : '';

    if (supplier) {
      suppliers.add(supplier);
    }
  }

  const trimmedCurrent = currentSupplier?.trim();
  if (trimmedCurrent) {
    suppliers.add(trimmedCurrent);
  }

  return [...suppliers].sort((left, right) => left.localeCompare(right, 'es'));
}

export function filterSupplierSuggestions(suppliers: string[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return [];
  }

  return suppliers
    .filter(
      (supplier) =>
        supplier.toLowerCase().includes(normalizedQuery) &&
        supplier.toLowerCase() !== normalizedQuery,
    )
    .slice(0, 8);
}

export function isGranelProduct(product: Pick<Product, 'description' | 'name'>): boolean {
  const name = product.name.toLowerCase();
  const notes = (product.description ?? '').toLowerCase();

  return name.includes('granel') || notes.includes('granel');
}

export function getProductStatusLabelFromSlug(slug: ProductStatusSlug): string {
  return PRODUCT_STATUS_OPTIONS.find((option) => option.value === slug)?.label ?? 'En stock';
}

export function readProductStatusSlug(product: Product): ProductStatusSlug {
  const rawStatus = product.metadata.estado;

  if (typeof rawStatus === 'string') {
    const normalized = rawStatus.trim().toLowerCase().replace(/\s+/g, '_');
    if (PRODUCT_STATUS_OPTIONS.some((option) => option.value === normalized)) {
      return normalized as ProductStatusSlug;
    }
  }

  if (!product.isActive) {
    return 'archivado';
  }

  if (product.isLowStock) {
    return 'sin_stock';
  }

  return 'en_stock';
}

export function normalizeBaseUnitCode(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? 'kg';
  const match = BASE_UNIT_OPTIONS.find((option) => option.value === normalized);
  return match?.value ?? normalized;
}

export function getBaseUnitLabel(value: string | null | undefined): string {
  const normalized = normalizeBaseUnitCode(value);
  return BASE_UNIT_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized;
}

export function readProductCodeType(product: Product): ProductCodeTypeSlug {
  const rawType = product.metadata.tipo_codigo;

  if (typeof rawType === 'string') {
    const normalized = rawType.trim().toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'qr' || normalized === 'codigo_qr') {
      return 'qr';
    }
  }

  return 'codigo_de_barras';
}

export function getProductCodeTypeLabel(product: Product): string {
  return PRODUCT_CODE_TYPE_LABELS[readProductCodeType(product)];
}

export function readProductCodeValue(product: Product): string {
  const metadata = product.metadata;
  const storedCode = metadata.codigo;

  if (typeof storedCode === 'string' && storedCode.trim().length > 0) {
    return storedCode.trim();
  }

  const barcode = metadata.codigo_barras;
  if (typeof barcode === 'string' && barcode.trim().length > 0) {
    return barcode.trim();
  }

  if (product.sku?.trim()) {
    return product.sku.trim();
  }

  return 'No Disponible';
}

export function isProductCodeUnavailable(product: Product): boolean {
  const value = readProductCodeValue(product).toLocaleLowerCase('es');
  return value === 'no disponible' || value === 'sin codigo' || value === 'sin código';
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function formatUnitLabel(
  quantity: number,
  unitCode: string | null | undefined,
): string {
  const normalized = normalizeBaseUnitCode(unitCode);
  const labels = UNIT_DISPLAY_LABELS[normalized] ?? {
    plural: normalized,
    singular: normalized,
  };
  const unit = Math.abs(quantity) === 1 ? labels.singular : labels.plural;

  return `${formatQuantity(quantity)} ${unit}`;
}

export function formatProductStockLabel(product: Product): string {
  return formatUnitLabel(product.stockQuantity, product.unitCode ?? product.baseUnitCode);
}

export function isInactiveProductStatus(status: ProductStatusSlug): boolean {
  return status === 'archivado' || status === 'descontinuado';
}

/** How many parent base units one subproduct unit consumes (e.g. 0.25 kg per paquete). */
export function readSubproductBaseEquivalent(product: Product): number | null {
  return product.baseUnitEquivalent;
}

/** Parent stock consumed when adding `quantity` units to a subproduct. */
export function computeParentStockDeduction(
  quantity: number,
  subproduct: Product,
): number | null {
  const equivalent = readSubproductBaseEquivalent(subproduct);

  if (equivalent == null || equivalent <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return quantity * equivalent;
}

export function formatSubproductBaseConversion(
  subproduct: Product,
  parentProduct: Product | null,
): string {
  const equivalent = readSubproductBaseEquivalent(subproduct);

  if (!equivalent || !parentProduct) {
    return 'Sin equivalencia configurada';
  }

  const subUnitLabel = getBaseUnitLabel(subproduct.unitCode ?? subproduct.baseUnitCode).toLowerCase();
  const parentAmount = formatUnitLabel(
    equivalent,
    parentProduct.unitCode ?? parentProduct.baseUnitCode,
  );

  return `1 ${subUnitLabel} = ${parentAmount} del producto base`;
}
