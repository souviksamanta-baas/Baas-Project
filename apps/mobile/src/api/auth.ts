import type { Session } from '@supabase/supabase-js';

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

  const code = params.otpCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Ingresá el código de 6 dígitos del correo.');
  }

  const body = await apiFetchJson<{ tokenHash: string }>('/auth/otp/email/verify', {
    body: JSON.stringify({
      code,
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
}): Promise<Session> {
  const normalizedPhone = normalizePhoneNumber(params.phone);

  if (!normalizedPhone) {
    throw new Error('Ingresá un número válido (011…, +5411… o +54911…).');
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token: params.otpCode.trim(),
    type: 'sms',
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.session) {
    throw new Error('No se pudo crear la sesión. Pedí un código nuevo.');
  }

  return data.session;
}

/** Exchange Nest-minted magiclink hash for a Supabase session. */
async function exchangeTokenHashForSession(tokenHash: string): Promise<Session> {
  const primary = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });

  if (!primary.error && primary.data.session) {
    return primary.data.session;
  }

  // Some Auth versions accept magiclink for admin.generateLink hashes.
  const fallback = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (!fallback.error && fallback.data.session) {
    return fallback.data.session;
  }

  throw new Error(
    primary.error?.message ||
      fallback.error?.message ||
      'No se pudo crear la sesión. Pedí un código nuevo.',
  );
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
}): Promise<Session> {
  if (params.channel === 'whatsapp') {
    const normalizedPhone = normalizePhoneNumber(params.identifier);

    if (!normalizedPhone) {
      throw new Error('Ingresá un número válido (011…, +5411… o +54911…).');
    }

    const tokenHash = await verifyWhatsAppOtp({
      otpCode: params.otpCode,
      phoneE164: normalizedPhone,
    });
    return exchangeTokenHashForSession(tokenHash);
  }

  if (params.channel === 'sms') {
    return verifyPhoneOtp({ phone: params.identifier, otpCode: params.otpCode });
  }

  const tokenHash = await verifyEmailOtp({
    email: params.identifier,
    otpCode: params.otpCode,
  });
  return exchangeTokenHashForSession(tokenHash);
}

export async function signOutOwner(): Promise<void> {
  // Prefer local clear so a dead refresh token cannot block logout / new OTP.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    await supabase.auth.signOut();
  }
}

export { getAccessToken } from './client';
