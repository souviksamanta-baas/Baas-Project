import { describe, expect, it } from 'vitest';

import { normalizePhoneNumber } from '../src/services/phone';

describe('normalizePhoneNumber', () => {
  it('keeps valid E.164 Argentina mobile numbers', () => {
    expect(normalizePhoneNumber('+5491112345678')).toBe('+5491112345678');
  });

  it('normalizes Argentina numbers with country code but no plus', () => {
    expect(normalizePhoneNumber('5491112345678')).toBe('+5491112345678');
  });

  it('normalizes Buenos Aires mobile domestic format with 15 marker', () => {
    expect(normalizePhoneNumber('011 15 1234 5678')).toBe('+5491112345678');
  });

  it('normalizes national Argentina mobile format without 15 marker', () => {
    expect(normalizePhoneNumber('11 1234 5678')).toBe('+5491112345678');
  });

  it('rejects incomplete phone numbers', () => {
    expect(normalizePhoneNumber('123')).toBeNull();
  });
});
