export function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';

  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message)) {
    return 'Pediste demasiados códigos de correo. Esperá un momento e intentá de nuevo.';
  }

  if (
    /Error sending confirmation email|unexpected_failure/i.test(message) ||
    /only send testing emails to your own email address/i.test(message) ||
    /verify a domain at resend\.com|SMTP aún en modo prueba|Platform email auth is not configured/i.test(
      message,
    )
  ) {
    return [
      'No se pudo enviar el correo (Resend).',
      'Hace falta una API key en el servidor y el dominio nexolia.com.ar verificado en Resend.',
    ].join(' ');
  }

  if (/Invalid Refresh Token|Refresh Token Not Found/i.test(message)) {
    return 'La sesión anterior ya no es válida. Cerrá sesión o borrá la app y volvé a pedir un código.';
  }

  if (/rate limit|too many requests|429|Esperá \d+s antes de pedir/i.test(message)) {
    return 'Pediste demasiados códigos seguidos. Esperá unos segundos antes de intentar de nuevo.';
  }

  if (/unverified/i.test(message) || /21608/.test(message) || /Trial accounts cannot send/i.test(message)) {
    return [
      'No pudimos enviar el SMS: la cuenta Twilio está en modo prueba.',
      'Verificá ese número en Twilio (Verified Caller IDs) o pasá Twilio a pago.',
      'Si ves la opción WhatsApp, usala en lugar de SMS.',
    ].join(' ');
  }

  if (/Platform WhatsApp auth is not configured/i.test(message)) {
    return 'WhatsApp de Nexolia aún no está configurado en el servidor. Usá SMS (Twilio) o pedile al dueño que reintente más tarde.';
  }

  if (/token.*expired|otp.*expired|invalid.*otp|invalid.*token/i.test(message)) {
    return 'El código no es válido o ya venció. Pedí uno nuevo cuando puedas.';
  }

  return message;
}
