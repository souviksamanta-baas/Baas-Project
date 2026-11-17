import type { SupabaseClient } from '@supabase/supabase-js';

export const OTP_MAX_ATTEMPTS = 5;

export type AuthOtpClaimResult =
  | {
      attempts: number;
      codeHash: string;
      expiresAt: string;
      id: string;
      ok: true;
    }
  | {
      ok: false;
      reason: 'missing' | 'expired' | 'locked';
    };

type ClaimRpcRow = {
  attempts?: number;
  code_hash?: string;
  expires_at?: string;
  id?: string;
  ok?: boolean;
  reason?: string;
};

export async function claimAuthOtpAttempt(params: {
  channel: 'email' | 'whatsapp';
  client: SupabaseClient;
  email?: string;
  phoneE164?: string;
  purpose: string;
}): Promise<AuthOtpClaimResult> {
  const { data, error } = await params.client.rpc('claim_auth_otp_attempt', {
    p_channel: params.channel,
    p_email: params.email ?? null,
    p_max_attempts: OTP_MAX_ATTEMPTS,
    p_phone_e164: params.phoneE164 ?? null,
    p_purpose: params.purpose,
  });

  if (error) {
    console.error(`[auth-otp] Failed to claim OTP attempt: ${error.message}`);
    throw new Error('No se pudo verificar el código. Intentá de nuevo.');
  }

  const row = (data ?? {}) as ClaimRpcRow;
  if (!row.ok) {
    const reason =
      row.reason === 'expired' || row.reason === 'locked' ? row.reason : 'missing';
    return { ok: false, reason };
  }

  if (!row.id || !row.code_hash || !row.expires_at) {
    return { ok: false, reason: 'missing' };
  }

  return {
    attempts: Number(row.attempts ?? 0),
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    id: row.id,
    ok: true,
  };
}

export async function assertAuthOtpIdentityUnlocked(params: {
  channel: 'email' | 'whatsapp';
  client: SupabaseClient;
  email?: string;
  phoneE164?: string;
  purpose: string;
}): Promise<void> {
  const { data, error } = await params.client.rpc('auth_otp_identity_is_locked', {
    p_channel: params.channel,
    p_email: params.email ?? null,
    p_max_attempts: OTP_MAX_ATTEMPTS,
    p_phone_e164: params.phoneE164 ?? null,
    p_purpose: params.purpose,
  });

  if (error) {
    console.error(`[auth-otp] Failed to check OTP lockout: ${error.message}`);
    throw new Error('No se pudo enviar el código. Intentá de nuevo en unos segundos.');
  }

  if (data === true) {
    throw new Error('Demasiados intentos. Pedí un código nuevo más tarde.');
  }
}

export function otpClaimFailureMessage(reason: 'missing' | 'expired' | 'locked'): string | null {
  if (reason === 'locked') {
    return 'Demasiados intentos. Pedí un código nuevo.';
  }
  if (reason === 'expired') {
    return 'El código expiró. Pedí uno nuevo.';
  }
  return null;
}
