export function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';

  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message)) {
    return 'Supabase bloqueó el envío: el SMTP integrado permite solo 2 correos por hora en este proyecto. Configurá SMTP propio (ver docs/supabase-smtp-setup.md) o esperá hasta la próxima hora en punto.';
  }

  if (/rate limit|too many requests|429/i.test(message)) {
    return 'Pediste demasiados códigos seguidos. Esperá al menos 60 segundos antes de intentar de nuevo.';
  }

  if (/unverified/i.test(message) || /21608/.test(message)) {
    return 'No pudimos enviar el SMS por Twilio. Verificá el número en twilio.com (cuentas de prueba) o usá WhatsApp o correo.';
  }

  if (/Platform WhatsApp auth is not configured/i.test(message)) {
    return 'WhatsApp login no está configurado todavía. Probá correo electrónico o SMS.';
  }

  if (/token.*expired|otp.*expired|invalid.*otp|invalid.*token/i.test(message)) {
    return 'El código no es válido o ya venció. Pedí uno nuevo cuando puedas.';
  }

  return message;
}
