import type { AuthOtpChannel } from './authChannel';

/** Supabase email OTP on hosted projects uses 8 digits; phone/WhatsApp OTP use 6. */
export function getOtpCodeLength(channel: AuthOtpChannel): number {
  return channel === 'email' ? 8 : 6;
}

export function normalizeOtpInput(value: string, channel: AuthOtpChannel): string {
  return value.replace(/\D/g, '').slice(0, getOtpCodeLength(channel));
}

export function isOtpCodeComplete(code: string, channel: AuthOtpChannel): boolean {
  return normalizeOtpInput(code, channel).length === getOtpCodeLength(channel);
}
