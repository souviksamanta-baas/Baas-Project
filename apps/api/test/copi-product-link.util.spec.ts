import { describe, expect, it } from 'vitest';

import {
  collectProductsFromToolResults,
  ensureCopiProductLinks,
  formatCopiProductLink,
} from '../src/domains/ai/copi-product-link.util';

describe('copi product links', () => {
  it('formats product markup', () => {
    expect(formatCopiProductLink('11111111-1111-1111-1111-111111111111', 'Yerba Amanda')).toBe(
      '[[product:11111111-1111-1111-1111-111111111111|Yerba Amanda]]',
    );
  });

  it('collects products from low_stock and sales payloads', () => {
    const products = collectProductsFromToolResults([
      {
        payload: {
          products: [{ id: '11111111-1111-1111-1111-111111111111', name: 'Yerba Amanda' }],
        },
      },
      {
        payload: {
          items: [{ productId: '22222222-2222-2222-2222-222222222222', name: 'Leche' }],
        },
      },
    ]);

    expect(products).toEqual([
      { id: '11111111-1111-1111-1111-111111111111', name: 'Yerba Amanda' },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Leche' },
    ]);
  });

  it('auto-links bare product names without breaking existing markup', () => {
    const linked = ensureCopiProductLinks('Stock bajo: Yerba Amanda necesita atención.', [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Yerba Amanda' },
    ]);
    expect(linked).toContain('[[product:11111111-1111-1111-1111-111111111111|Yerba Amanda]]');

    const already = ensureCopiProductLinks(
      'Ver [[product:11111111-1111-1111-1111-111111111111|Yerba Amanda]] ahora.',
      [{ id: '11111111-1111-1111-1111-111111111111', name: 'Yerba Amanda' }],
    );
    expect(already).toBe('Ver [[product:11111111-1111-1111-1111-111111111111|Yerba Amanda]] ahora.');
  });
});
