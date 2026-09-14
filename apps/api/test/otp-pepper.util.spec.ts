import { afterEach, describe, expect, it } from 'vitest';

import { resolveOtpPepper } from '../src/auth/otp-pepper.util';

const ORIGINAL_ENV = {
  BAAS_OTP_PEPPER: process.env.BAAS_OTP_PEPPER,
  NODE_ENV: process.env.NODE_ENV,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

afterEach(() => {
  process.env.BAAS_OTP_PEPPER = ORIGINAL_ENV.BAAS_OTP_PEPPER;
  process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_ENV.SUPABASE_SERVICE_ROLE_KEY;
});

describe('resolveOtpPepper', () => {
  it('prefers BAAS_OTP_PEPPER when set', () => {
    process.env.BAAS_OTP_PEPPER = '  explicit-pepper  ';
    process.env.NODE_ENV = 'production';
    expect(resolveOtpPepper()).toBe('explicit-pepper');
  });

  it('requires BAAS_OTP_PEPPER in production', () => {
    delete process.env.BAAS_OTP_PEPPER;
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    expect(() => resolveOtpPepper()).toThrow(/BAAS_OTP_PEPPER is required in production/);
  });

  it('falls back in non-production when pepper is unset', () => {
    delete process.env.BAAS_OTP_PEPPER;
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    expect(resolveOtpPepper()).toBe('service-role-key');

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(resolveOtpPepper()).toBe('nexolia-otp-dev-pepper');
  });
});
