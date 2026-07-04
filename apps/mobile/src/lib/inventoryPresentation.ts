import type { InventoryProductMock, SellProductMock } from '../api/inventoryMockData';
import {
  getProductStatusLabelFromSlug,
  readProductStatusSlug,
} from './productCatalog';
import type { Product } from '../types/products';

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function mapProductToInventoryRow(
  product: Product,
  options?: { isBase?: boolean; indent?: boolean },
): InventoryProductMock {
  const category = product.category ?? 'Sin categoría';
  const stockLabel = `${formatQuantity(product.stockQuantity)} ${product.unitCode}`;

  return {
    category,
    code: product.sku ?? 'Sin codigo',
    codeTone: product.sku ? undefined : 'red',
    createCode: !product.sku,
    id: product.id,
    indent: options?.indent ?? Boolean(product.parentProductId),
    isBase: options?.isBase ?? false,
    name: product.name,
    status: getProductStatusLabel(product),
    statusTone: product.isLowStock ? 'orange' : 'green',
    stock: stockLabel,
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
): InventoryProductMock[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');

  if (normalizedQuery.length === 0) {
    return products;
  }

  return products.filter((product) => {
    const haystack = [product.name, product.category, product.code].join(' ').toLocaleLowerCase('es');
    return haystack.includes(normalizedQuery);
  });
}

export function formatProductCost(product: Product): string {
  const rawCost = product.metadata?.precio_costo_cents;

  if (typeof rawCost === 'number') {
    return `$${(rawCost / 100).toFixed(2)}`;
  }

  return '—';
}

export function formatProductStockLabel(product: Product): string {
  return `${formatQuantity(product.stockQuantity)} ${product.unitCode}`;
}

export function formatProductUnitPrice(product: Product): string {
  return `$${(product.unitPriceCents / 100).toFixed(2)}`;
}

export function getProductStatusLabel(product: Product): string {
  return getProductStatusLabelFromSlug(readProductStatusSlug(product));
}

export function buildProductSummaryMeta(
  product: Product,
  businessCenterName?: string | null,
): {
  branch: string;
  code: string;
  cost: string;
  margin: string;
  price: string;
  sku: string;
  unit: string;
} {
  return {
    branch: businessCenterName ?? '—',
    code: product.sku ?? 'Sin codigo',
    cost: formatProductCost(product),
    margin: '—',
    price: formatProductUnitPrice(product),
    sku: product.sku ?? '—',
    unit: product.unitCode,
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
    addKg: product.unitCode === 'kg' && !product.parentProductId,
    id: product.id,
    indent,
    linkedTo: product.parentProductId ? parentNames.get(product.parentProductId) : undefined,
    name: product.name,
    price: formatProductUnitPrice(product),
    stock: `Stock ${formatProductStockLabel(product)}`,
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
    const haystack = [product.name, product.linkedTo ?? '', product.price, product.stock]
      .join(' ')
      .toLocaleLowerCase('es');
    return haystack.includes(normalizedQuery);
  });
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}
