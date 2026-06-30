import { describe, expect, it } from 'vitest';

import { phoneToSyntheticEmail, normalizeWhatsAppRecipient } from '../src/domains/auth/auth-phone.util';

describe('auth-phone.util', () => {
  it('maps E.164 phone to synthetic auth email', () => {
    expect(phoneToSyntheticEmail('+5491112345678')).toBe('5491112345678@auth.nexolia.app');
  });

  it('strips plus for WhatsApp recipient', () => {
    expect(normalizeWhatsAppRecipient('+5491112345678')).toBe('5491112345678');
  });
});
