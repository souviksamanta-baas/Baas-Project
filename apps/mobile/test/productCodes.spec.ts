import { describe, expect, it } from 'vitest';

import {
  findProductByScannedCode,
  productCodeMatchCandidates,
} from '../src/lib/productCodes';
import type { Product } from '../src/types/products';

function product(partial: Partial<Product> & Pick<Product, 'id' | 'name'>): Product {
  return {
    baseUnitCode: 'u',
    baseUnitEquivalent: null,
    category: null,
    currency: 'ARS',
    description: null,
    inventoryItemId: null,
    isActive: true,
    isLowStock: false,
    metadata: {},
    organizationId: 'org',
    parentProductId: null,
    productType: 'producto',
    reorderThreshold: 0,
    sku: null,
    stockQuantity: 0,
    unitCode: 'u',
    unitPriceCents: 100,
    ...partial,
  };
}

describe('productCodeMatchCandidates', () => {
  it('adds EAN/UPC leading-zero variants', () => {
    expect(productCodeMatchCandidates('779123456789')).toEqual(
      expect.arrayContaining(['779123456789', '0779123456789']),
    );
    expect(productCodeMatchCandidates('0779123456789')).toEqual(
      expect.arrayContaining(['0779123456789', '779123456789']),
    );
  });
});

describe('findProductByScannedCode', () => {
  const catalog = [
    product({
      id: 'p1',
      metadata: {
        codigo: '7790001112223',
        codigo_barras: '7790001112223',
        tipo_codigo: 'codigo_de_barras',
      },
      name: 'Yerba',
      sku: 'YERBA-1',
    }),
    product({
      id: 'p2',
      metadata: { codigo: 'No Disponible' },
      name: 'Sin codigo',
      sku: 'SIN-1',
    }),
  ];

  it('matches exact barcode and upc/ean variants', () => {
    expect(findProductByScannedCode(catalog, '7790001112223')?.id).toBe('p1');
    expect(findProductByScannedCode(catalog, '07790001112223')?.id).toBe('p1');
  });

  it('matches sku', () => {
    expect(findProductByScannedCode(catalog, 'YERBA-1')?.id).toBe('p1');
  });

  it('skips unavailable placeholder codes', () => {
    expect(findProductByScannedCode(catalog, 'No Disponible')).toBeNull();
  });
});
