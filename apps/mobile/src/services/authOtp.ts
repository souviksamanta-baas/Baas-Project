import type { AuthOtpChannel } from './authChannel';

/** Nest platform email/WhatsApp OTP and Supabase SMS OTP all use 6 digits. */
export function getOtpCodeLength(_channel: AuthOtpChannel): number {
  return 6;
}

export function normalizeOtpInput(value: string, channel: AuthOtpChannel): string {
  return value.replace(/\D/g, '').slice(0, getOtpCodeLength(channel));
}

export function isOtpCodeComplete(code: string, channel: AuthOtpChannel): boolean {
  return normalizeOtpInput(code, channel).length === getOtpCodeLength(channel);
}
