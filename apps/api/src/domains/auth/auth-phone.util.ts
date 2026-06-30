export function phoneToSyntheticEmail(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  return `${digits}@auth.nexolia.app`;
}

export function normalizeWhatsAppRecipient(phoneE164: string): string {
  return phoneE164.replace(/^\+/, '');
}
