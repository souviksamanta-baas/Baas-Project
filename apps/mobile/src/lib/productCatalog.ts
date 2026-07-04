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
  { label: 'kg', value: 'kg' },
  { label: 'Lata', value: 'lata' },
  { label: 'Paquete', value: 'paquete' },
]);

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

export function isInactiveProductStatus(status: ProductStatusSlug): boolean {
  return status === 'archivado' || status === 'descontinuado';
}
