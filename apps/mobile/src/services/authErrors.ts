export function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';

  if (/unverified/i.test(message) || /21608/.test(message)) {
    return 'No pudimos enviar el SMS por Twilio. Verificá el número en twilio.com (cuentas de prueba) o usá WhatsApp o correo.';
  }

  if (/Platform WhatsApp auth is not configured/i.test(message)) {
    return 'WhatsApp login no está configurado todavía. Probá correo electrónico o SMS.';
  }

  return message;
}
