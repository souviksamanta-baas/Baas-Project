function isLikelySpanishMessage(message: string): boolean {
  if (/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(message)) {
    return true;
  }

  return /^(no se |no pudimos |pedí|pediste|el código|ingresá|esperá|demasiados|whatsapp de |la sesión|la api |ocurrió )/i.test(
    message,
  );
}

export function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';

  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message)) {
    return 'Pediste demasiados códigos de correo. Esperá un momento e intentá de nuevo.';
  }

  if (
    /Error sending confirmation email|unexpected_failure/i.test(message) ||
    /only send testing emails to your own email address/i.test(message) ||
    /verify a domain at resend\.com|SMTP aún en modo prueba|Platform email auth is not configured|envío de correo de ingreso no está configurado/i.test(
      message,
    )
  ) {
    return 'No se pudo enviar el correo. Intentá de nuevo en unos minutos o usá SMS.';
  }

  if (/Invalid Refresh Token|Refresh Token Not Found/i.test(message)) {
    return 'La sesión anterior ya no es válida. Cerrá sesión o borrá la app y volvé a pedir un código.';
  }

  if (/Auth session missing|session_not_found|Session not found/i.test(message)) {
    return 'No se pudo abrir la sesión. Pedí un código nuevo e intentá otra vez.';
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

  if (
    /Platform WhatsApp auth is not configured|WhatsApp de ingreso no está configurado|WhatsApp de Nexolia aún no está configurado/i.test(
      message,
    )
  ) {
    return 'WhatsApp de Nexolia aún no está configurado en el servidor. Usá SMS o correo, o reintentá más tarde.';
  }

  if (
    /otp.*expired|token.*expired|invalid.*(otp|token|login)|Email link is invalid|código no es válido|Código inválido|código expiró/i.test(
      message,
    )
  ) {
    return 'El código no es válido o ya venció. Pedí uno nuevo cuando puedas.';
  }

  if (
    /Failed to create login session|Failed to exchange login session|Failed to create auth user|No se pudo crear la sesión/i.test(
      message,
    )
  ) {
    return 'El código es correcto, pero no pudimos abrir la sesión. Pedí un código nuevo e intentá otra vez.';
  }

  // Never surface raw Nest/Postgres/English internals in the login UI.
  if (
    /Failed to check OTP cooldown|Failed to store OTP|Failed to load OTP|permission denied|auth_otp_challenges|Meta OTP send failed|HTTP \d{3}/i.test(
      message,
    )
  ) {
    return 'No se pudo enviar el código. Intentá de nuevo en unos segundos.';
  }

  if (!isLikelySpanishMessage(message)) {
    return 'No se pudo completar el inicio de sesión. Intentá de nuevo.';
  }

  return message;
}
