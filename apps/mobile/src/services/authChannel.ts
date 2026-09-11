export type AuthOtpChannel = 'email' | 'sms' | 'whatsapp';

const ALL_AUTH_OTP_CHANNELS: AuthOtpChannel[] = ['email', 'whatsapp', 'sms'];

function isAuthOtpChannel(value: string): value is AuthOtpChannel {
  return ALL_AUTH_OTP_CHANNELS.includes(value as AuthOtpChannel);
}

/** Production ships email-only until Meta business verification + auth template. */
export function getLoginAuthChannels(): AuthOtpChannel[] {
  const raw = process.env.EXPO_PUBLIC_AUTH_LOGIN_CHANNELS?.trim();

  if (!raw) {
    return ['email'];
  }

  const parsed = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(isAuthOtpChannel);

  return parsed.length > 0 ? parsed : ['email'];
}

/**
 * Staff invite accept + returning phone sign-in.
 * WhatsApp stays off until the Spanish AUTHENTICATION template is approved in Meta.
 * Override with EXPO_PUBLIC_AUTH_STAFF_PHONE_CHANNELS when ready (e.g. whatsapp,sms).
 */
export function getStaffPhoneAuthChannels(): AuthOtpChannel[] {
  const raw = process.env.EXPO_PUBLIC_AUTH_STAFF_PHONE_CHANNELS?.trim();
  if (raw) {
    const parsed = raw
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(isPhoneAuthChannel);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  const fromLogin = getLoginAuthChannels().filter((channel) => isPhoneAuthChannel(channel));
  if (fromLogin.length > 0) {
    return fromLogin;
  }

  // SMS only until Meta Spanish auth template is available.
  return ['sms'];
}

/**
 * Channel list for the login screen by entry intent.
 * - create business → email only
 * - returning sign-in → phone channels (staff QR path) + any configured login channels
 */
export function getAuthChannelsForIntent(
  intent: 'create' | 'signin' | null | undefined,
): AuthOtpChannel[] {
  if (intent === 'create') {
    return ['email'];
  }

  if (intent === 'signin') {
    const phone = getStaffPhoneAuthChannels();
    const login = getLoginAuthChannels();
    const merged: AuthOtpChannel[] = [];

    // Login channels first so owners land on email when production is email-only;
    // staff can still switch to SMS on the login screen.
    for (const channel of [...login, ...phone]) {
      if (!merged.includes(channel)) {
        merged.push(channel);
      }
    }

    return merged.length > 0 ? merged : ['sms'];
  }

  return getLoginAuthChannels();
}

export function getDefaultChannelForIntent(
  intent: 'create' | 'signin' | null | undefined,
): AuthOtpChannel {
  const channels = getAuthChannelsForIntent(intent);

  if (intent === 'signin') {
    // Prefer configured owner login channel (email in production) over staff SMS.
    const loginDefault = getLoginAuthChannels()[0];
    if (loginDefault && channels.includes(loginDefault)) {
      return loginDefault;
    }
    return channels.find((channel) => isPhoneAuthChannel(channel)) ?? channels[0] ?? 'sms';
  }

  if (intent === 'create') {
    return 'email';
  }

  return channels[0] ?? 'email';
}

export const DEFAULT_AUTH_OTP_CHANNEL: AuthOtpChannel = getLoginAuthChannels()[0] ?? 'email';

export function isPhoneAuthChannel(channel: AuthOtpChannel): boolean {
  return channel === 'sms' || channel === 'whatsapp';
}

export function authChannelLabel(channel: AuthOtpChannel): string {
  switch (channel) {
    case 'email':
      return 'Correo electrónico';
    case 'whatsapp':
      return 'WhatsApp';
    case 'sms':
      return 'SMS';
  }
}

export function authChannelDeliveryHint(channel: AuthOtpChannel): string {
  switch (channel) {
    case 'email':
      return 'Te enviaremos un código a tu correo.';
    case 'whatsapp':
      return 'Recibirás un código de Nexolia por WhatsApp. El número no tiene que ser el WhatsApp de tu negocio.';
    case 'sms':
      return 'Te enviaremos un código por SMS (Twilio). Podés usar 011…, +5411… o +54911…. Tiene costo por mensaje.';
  }
}
