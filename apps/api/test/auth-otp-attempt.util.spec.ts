import { describe, expect, it, vi } from 'vitest';

import {
  assertAuthOtpIdentityUnlocked,
  claimAuthOtpAttempt,
  otpClaimFailureMessage,
} from '../src/domains/auth/auth-otp-attempt.util';

describe('otpClaimFailureMessage', () => {
  it('maps lock and expiry reasons', () => {
    expect(otpClaimFailureMessage('locked')).toMatch(/Demasiados intentos/);
    expect(otpClaimFailureMessage('expired')).toMatch(/expiró/);
    expect(otpClaimFailureMessage('missing')).toBeNull();
  });
});

describe('claimAuthOtpAttempt', () => {
  it('returns the claimed challenge on success', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        ok: true,
        id: 'challenge-1',
        code_hash: 'abc',
        attempts: 1,
        expires_at: '2099-01-01T00:00:00.000Z',
      },
      error: null,
    }));

    await expect(
      claimAuthOtpAttempt({
        channel: 'email',
        client: { rpc } as never,
        email: 'a@example.com',
        purpose: 'login',
      }),
    ).resolves.toEqual({
      ok: true,
      id: 'challenge-1',
      codeHash: 'abc',
      attempts: 1,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    expect(rpc).toHaveBeenCalledWith('claim_auth_otp_attempt', {
      p_channel: 'email',
      p_email: 'a@example.com',
      p_max_attempts: 5,
      p_phone_e164: null,
      p_purpose: 'login',
    });
  });

  it('surfaces identity lockout', async () => {
    const rpc = vi.fn(async () => ({
      data: { ok: false, reason: 'locked' },
      error: null,
    }));

    await expect(
      claimAuthOtpAttempt({
        channel: 'whatsapp',
        client: { rpc } as never,
        phoneE164: '+5491111111111',
        purpose: 'login',
      }),
    ).resolves.toEqual({ ok: false, reason: 'locked' });
  });
});

describe('assertAuthOtpIdentityUnlocked', () => {
  it('throws when the identity is locked across challenges', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));

    await expect(
      assertAuthOtpIdentityUnlocked({
        channel: 'email',
        client: { rpc } as never,
        email: 'a@example.com',
        purpose: 'login',
      }),
    ).rejects.toThrow(/Demasiados intentos/);
  });
});
