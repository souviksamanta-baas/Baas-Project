import type { InventoryProductMock, SellProductMock } from '../api/inventoryMockData';
import { formatPercentInput, calculateMarginFromCostAndPrice } from './productEditForm';
import {
  formatProductStockLabel,
  formatUnitLabel,
  getProductCodeTypeLabel,
  getProductStatusLabelFromSlug,
  isProductCodeUnavailable,
  readProductCodeValue,
  readProductStatusSlug,
  readSubproductBaseEquivalent,
} from './productCatalog';
import type { Product } from '../types/products';
import { isSoldByWeight } from './sellCart';

export function mapProductToInventoryRow(
  product: Product,
  options?: { isBase?: boolean; indent?: boolean },
): InventoryProductMock {
  const category = product.category ?? 'Sin categoría';
  const codeValue = readProductCodeValue(product);
  const codeUnavailable = isProductCodeUnavailable(product);

  return {
    category,
    code: codeUnavailable ? 'No Disponible' : codeValue,
    codeTone: codeUnavailable ? 'red' : undefined,
    createCode: codeUnavailable,
    id: product.id,
    indent: options?.indent ?? Boolean(product.parentProductId),
    isBase: options?.isBase ?? false,
    name: product.name,
    status: getProductStatusLabel(product),
    statusTone: product.isLowStock ? 'orange' : 'green',
    stock: formatProductStockLabel(product),
  };
}

export function mapProductsToInventoryRows(products: Product[]): InventoryProductMock[] {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const childrenByParentId = new Map<string, Product[]>();
  const roots: Product[] = [];

  for (const product of products) {
    const parentId = product.parentProductId;

    if (parentId && productsById.has(parentId)) {
      const siblings = childrenByParentId.get(parentId) ?? [];
      siblings.push(product);
      childrenByParentId.set(parentId, siblings);
      continue;
    }

    roots.push(product);
  }

  roots.sort((left, right) => left.name.localeCompare(right.name, 'es'));

  for (const children of childrenByParentId.values()) {
    children.sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  const rows: InventoryProductMock[] = [];

  for (const root of roots) {
    const children = childrenByParentId.get(root.id) ?? [];

    rows.push(
      mapProductToInventoryRow(root, {
        indent: false,
        isBase: children.length > 0,
      }),
    );

    for (const child of children) {
      rows.push(
        mapProductToInventoryRow(child, {
          indent: true,
          isBase: false,
        }),
      );
    }
  }

  return rows;
}

export function filterInventoryProducts(
  products: InventoryProductMock[],
  query: string,
  options?: { lowStockOnly?: boolean },
): InventoryProductMock[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const lowStockOnly = options?.lowStockOnly === true;

  return products.filter((product) => {
    if (lowStockOnly && product.statusTone !== 'orange' && product.statusTone !== 'red') {
      return false;
    }

    if (normalizedQuery.length === 0) {
      return true;
    }

    const haystack = [product.name, product.category, product.code].join(' ').toLocaleLowerCase('es');
    return haystack.includes(normalizedQuery);
  });
}

export interface PaginatedItems<T> {
  items: T[];
  page: number;
  pageCount: number;
  rangeEnd: number;
  rangeStart: number;
  total: number;
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedItems<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);

  return {
    items: items.slice(startIndex, endIndex),
    page: safePage,
    pageCount: total === 0 ? 1 : pageCount,
    rangeEnd: endIndex,
    rangeStart: total === 0 ? 0 : startIndex + 1,
    total,
  };
}

export function getVisiblePageNumbers(currentPage: number, pageCount: number): number[] {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, currentPage, currentPage - 1, currentPage + 1]);

  return [...pages].filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right);
}

function readMetadataCents(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function resolveProductCostCents(
  product: Product,
  parentProduct?: Product | null,
): number | null {
  const directCost = readMetadataCents(product.metadata, 'precio_costo_cents');

  if (directCost != null) {
    return directCost;
  }

  if (!parentProduct) {
    return null;
  }

  const parentCost = readMetadataCents(parentProduct.metadata, 'precio_costo_cents');
  const equivalent = readSubproductBaseEquivalent(product);

  if (parentCost == null || equivalent == null) {
    return null;
  }

  return Math.round(parentCost * equivalent);
}

export function resolveProductSalePriceCents(
  product: Product,
  childProducts?: Product[],
): number | null {
  if (product.unitPriceCents > 0) {
    return product.unitPriceCents;
  }

  for (const child of childProducts ?? []) {
    const equivalent = readSubproductBaseEquivalent(child);

    if (child.unitPriceCents > 0 && equivalent != null && equivalent > 0) {
      return Math.round(child.unitPriceCents / equivalent);
    }
  }

  return null;
}

export function formatProductSalePrice(
  product: Product,
  childProducts?: Product[],
): string {
  const salePriceCents = resolveProductSalePriceCents(product, childProducts);

  if (salePriceCents == null || salePriceCents <= 0) {
    return '—';
  }

  return `$${(salePriceCents / 100).toFixed(2)}`;
}

export function formatProductCost(product: Product, parentProduct?: Product | null): string {
  const costCents = resolveProductCostCents(product, parentProduct);

  if (costCents != null) {
    return `$${(costCents / 100).toFixed(2)}`;
  }

  return '—';
}

export { formatProductStockLabel } from './productCatalog';

export function formatProductUnitPrice(product: Product): string {
  return `$${(product.unitPriceCents / 100).toFixed(2)}`;
}

export function getProductStatusLabel(product: Product): string {
  return getProductStatusLabelFromSlug(readProductStatusSlug(product));
}

export function buildProductSummaryMeta(
  product: Product,
  businessCenterName?: string | null,
  parentProduct?: Product | null,
  childProducts?: Product[],
): {
  branch: string;
  codeLabel: string;
  codeUnavailable: boolean;
  codeValue: string;
  cost: string;
  margin: string;
  price: string;
  sku: string;
} {
  const costCents = resolveProductCostCents(product, parentProduct);
  const salePriceCents = resolveProductSalePriceCents(product, childProducts);
  const computedMargin =
    costCents != null && costCents > 0 && salePriceCents != null && salePriceCents > 0
      ? calculateMarginFromCostAndPrice(costCents / 100, salePriceCents / 100)
      : null;

  return {
    branch: businessCenterName ?? '—',
    codeLabel: getProductCodeTypeLabel(product),
    codeUnavailable: isProductCodeUnavailable(product),
    codeValue: readProductCodeValue(product),
    cost: formatProductCost(product, parentProduct),
    margin: computedMargin != null ? `${formatPercentInput(computedMargin)}%` : '—',
    price: formatProductSalePrice(product, childProducts),
    sku: product.sku ?? '—',
  };
}

export function mapProductsToSellRows(products: Product[]): SellProductMock[] {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const parentNames = new Map(products.map((product) => [product.id, product.name]));
  const childrenByParentId = new Map<string, Product[]>();
  const roots: Product[] = [];

  for (const product of products) {
    const parentId = product.parentProductId;

    if (parentId && productsById.has(parentId)) {
      const siblings = childrenByParentId.get(parentId) ?? [];
      siblings.push(product);
      childrenByParentId.set(parentId, siblings);
      continue;
    }

    roots.push(product);
  }

  roots.sort((left, right) => left.name.localeCompare(right.name, 'es'));

  for (const children of childrenByParentId.values()) {
    children.sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  const rows: SellProductMock[] = [];

  const mapSellRow = (product: Product, indent: boolean): SellProductMock => ({
    category: product.category ?? 'Sin categoria',
    code: isProductCodeUnavailable(product) ? '' : readProductCodeValue(product),
    id: product.id,
    indent,
    linkedTo: product.parentProductId ? parentNames.get(product.parentProductId) : undefined,
    name: product.name,
    price: formatProductUnitPrice(product),
    soldByWeight: isSoldByWeight(product),
    stock: `Stock ${formatProductStockLabel(product)}`,
    unitPriceCents: product.unitPriceCents,
  });

  for (const root of roots) {
    rows.push(mapSellRow(root, false));

    for (const child of childrenByParentId.get(root.id) ?? []) {
      rows.push(mapSellRow(child, true));
    }
  }

  return rows;
}

export function filterSellProducts(products: SellProductMock[], query: string): SellProductMock[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');

  if (normalizedQuery.length === 0) {
    return products;
  }

  return products.filter((product) => {
    const haystack = [product.name, product.linkedTo ?? '', product.price, product.stock, product.code ?? '']
      .join(' ')
      .toLocaleLowerCase('es');
    return haystack.includes(normalizedQuery);
  });
}

export function formatLotQuantityLabel(quantity: number, unitCode: string): string {
  return formatUnitLabel(quantity, unitCode);
}
