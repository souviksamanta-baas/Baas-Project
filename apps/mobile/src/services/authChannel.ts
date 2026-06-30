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

export function getStaffPhoneAuthChannels(): AuthOtpChannel[] {
  const phoneChannels = getLoginAuthChannels().filter((channel) => isPhoneAuthChannel(channel));

  return phoneChannels.length > 0 ? phoneChannels : ['sms'];
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
