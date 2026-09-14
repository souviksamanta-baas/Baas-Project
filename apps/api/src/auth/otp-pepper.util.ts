export function resolveOtpPepper(): string {
  const pepper = process.env.BAAS_OTP_PEPPER?.trim();
  if (pepper) {
    return pepper;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('BAAS_OTP_PEPPER is required in production');
  }

  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'nexolia-otp-dev-pepper';
}
