import { describe, expect, it } from 'vitest';

import { normalizeEmail } from '../src/services/email';

describe('normalizeEmail', () => {
  it('normalizes valid email addresses', () => {
    expect(normalizeEmail(' Owner@Example.COM ')).toBe('owner@example.com');
  });

  it('rejects invalid email addresses', () => {
    expect(normalizeEmail('owner')).toBeNull();
  });
});
