export type AuthOtpChannel = 'email' | 'sms';

export function getAuthOtpChannel(): AuthOtpChannel {
  const configured = process.env.EXPO_PUBLIC_AUTH_OTP_CHANNEL?.trim().toLowerCase();

  return configured === 'email' ? 'email' : 'sms';
}

export function isPhoneOtpChannel(): boolean {
  return getAuthOtpChannel() === 'sms';
}
