import { describe, expect, it } from 'vitest';

import { createUuid, isUuid, purchaseLineId } from './purchaseLineId';

describe('purchaseLineId', () => {
  it('keeps a stored uuid', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(purchaseLineId(id)).toBe(id);
  });

  it('replaces client line ids that are not uuids', () => {
    const id = purchaseLineId('PL-1-11111111-1111-4111-8111-111111111111');
    expect(isUuid(id)).toBe(true);
    expect(id.startsWith('PL-')).toBe(false);
  });

  it('creates a uuid when crypto.randomUUID is missing', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(isUuid(createUuid())).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: original,
      });
    }
  });
});
