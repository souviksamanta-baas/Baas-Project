import { supabase } from '../lib/supabase';
import type { AuthOtpChannel } from '../services/authChannel';
import { normalizeEmail } from '../services/email';
import { normalizePhoneNumber } from '../services/phone';
import { apiFetchJson } from './client';

export async function requestWhatsAppOtp(phoneE164: string): Promise<void> {
  await apiFetchJson('/auth/otp/whatsapp/request', {
    body: JSON.stringify({ phone: phoneE164 }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function verifyWhatsAppOtp(params: {
  otpCode: string;
  phoneE164: string;
}): Promise<string> {
  const body = await apiFetchJson<{ tokenHash: string }>('/auth/otp/whatsapp/verify', {
    body: JSON.stringify({
      code: params.otpCode.trim(),
      phone: params.phoneE164,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!body.tokenHash) {
    throw new Error('La API no devolvió un token de sesión.');
  }

  return body.tokenHash;
}

export async function requestEmailOtp(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Ingresá un correo válido.');
  }

  await apiFetchJson('/auth/otp/email/request', {
    body: JSON.stringify({ email: normalizedEmail }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function verifyEmailOtp(params: {
  email: string;
  otpCode: string;
}): Promise<string> {
  const normalizedEmail = normalizeEmail(params.email);

  if (!normalizedEmail) {
    throw new Error('Ingresá un correo válido.');
  }

  const body = await apiFetchJson<{ tokenHash: string }>('/auth/otp/email/verify', {
    body: JSON.stringify({
      code: params.otpCode.trim(),
      email: normalizedEmail,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!body.tokenHash) {
    throw new Error('La API no devolvió un token de sesión.');
  }

  return body.tokenHash;
}

export async function requestPhoneOtp(phone: string): Promise<void> {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    throw new Error('Ingresá un número válido (011…, +5411… o +54911…).');
  }

  const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });

  if (error) {
    throw new Error(error.message);
  }
}

export async function verifyPhoneOtp(params: {
  otpCode: string;
  phone: string;
}): Promise<void> {
  const normalizedPhone = normalizePhoneNumber(params.phone);

  if (!normalizedPhone) {
    throw new Error('Ingresá un número válido (011…, +5411… o +54911…).');
  }

  const { error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token: params.otpCode.trim(),
    type: 'sms',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function requestLoginOtp(params: {
  channel: AuthOtpChannel;
  identifier: string;
}): Promise<void> {
  if (params.channel === 'sms' || params.channel === 'whatsapp') {
    const normalizedPhone = normalizePhoneNumber(params.identifier);

    if (!normalizedPhone) {
      throw new Error('Ingresá un número válido (011…, +5411… o +54911…).');
    }

    if (params.channel === 'whatsapp') {
      await requestWhatsAppOtp(normalizedPhone);
      return;
    }

    await requestPhoneOtp(normalizedPhone);
    return;
  }

  await requestEmailOtp(params.identifier);
}

export async function verifyLoginOtp(params: {
  channel: AuthOtpChannel;
  identifier: string;
  otpCode: string;
}): Promise<void> {
  if (params.channel === 'whatsapp') {
    const normalizedPhone = normalizePhoneNumber(params.identifier);

    if (!normalizedPhone) {
      throw new Error('Ingresá un número válido (011…, +5411… o +54911…).');
    }

    const tokenHash = await verifyWhatsAppOtp({
      otpCode: params.otpCode,
      phoneE164: normalizedPhone,
    });
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    });

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  if (params.channel === 'sms') {
    await verifyPhoneOtp({ phone: params.identifier, otpCode: params.otpCode });
    return;
  }

  const tokenHash = await verifyEmailOtp({
    email: params.identifier,
    otpCode: params.otpCode,
  });
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOutOwner(): Promise<void> {
  // Prefer local clear so a dead refresh token cannot block logout / new OTP.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    await supabase.auth.signOut();
  }
}

export { getAccessToken } from './client';
