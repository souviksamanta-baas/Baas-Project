export function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';

  if (/unverified/i.test(message) || /21608/.test(message)) {
    return 'Tu número no está verificado en Twilio. En cuentas de prueba, agregalo en twilio.com → Verified Caller IDs.';
  }

  return message;
}
