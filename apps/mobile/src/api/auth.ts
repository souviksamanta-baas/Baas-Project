import type { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { AuthOtpChannel } from '../services/authChannel';
import { normalizeEmail } from '../services/email';
import { normalizePhoneNumber } from '../services/phone';
import { apiFetchJson } from './client';

type NestSessionTokens = {
  accessToken?: string;
  refreshToken?: string;
  tokenHash?: string;
};

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
}): Promise<NestSessionTokens> {
  const body = await apiFetchJson<NestSessionTokens>('/auth/otp/whatsapp/verify', {
    body: JSON.stringify({
      code: params.otpCode.trim(),
      phone: params.phoneE164,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!body.accessToken && !body.tokenHash) {
    throw new Error('La API no devolvió un token de sesión.');
  }

  return body;
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
}): Promise<NestSessionTokens> {
  const normalizedEmail = normalizeEmail(params.email);

  if (!normalizedEmail) {
    throw new Error('Ingresá un correo válido.');
  }

  const code = params.otpCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Ingresá el código de 6 dígitos del correo.');
  }

  const body = await apiFetchJson<NestSessionTokens>('/auth/otp/email/verify', {
    body: JSON.stringify({
      code,
      email: normalizedEmail,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!body.accessToken && !body.tokenHash) {
    throw new Error('La API no devolvió un token de sesión.');
  }

  return body;
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

async function applyNestSessionTokens(tokens: NestSessionTokens): Promise<Session> {
  if (tokens.accessToken && tokens.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    if (error) {
      throw new Error(error.message);
    }
    if (!data.session) {
      throw new Error('No se pudo crear la sesión. Pedí un código nuevo.');
    }
    return data.session;
  }

  // Legacy fallback for older API builds that only returned tokenHash.
  if (!tokens.tokenHash) {
    throw new Error('La API no devolvió un token de sesión.');
  }

  const exchanged = await supabase.auth.verifyOtp({
    token_hash: tokens.tokenHash,
    type: 'magiclink',
  });

  if (exchanged.error || !exchanged.data.session) {
    throw new Error(
      exchanged.error?.message || 'No se pudo crear la sesión. Pedí un código nuevo.',
    );
  }

  return exchanged.data.session;
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

    const tokens = await verifyWhatsAppOtp({
      otpCode: params.otpCode,
      phoneE164: normalizedPhone,
    });
    return applyNestSessionTokens(tokens);
  }

  if (params.channel === 'sms') {
    return verifyPhoneOtp({ phone: params.identifier, otpCode: params.otpCode });
  }

  const tokens = await verifyEmailOtp({
    email: params.identifier,
    otpCode: params.otpCode,
  });
  return applyNestSessionTokens(tokens);
}

export async function signOutOwner(): Promise<void> {
  // Prefer local clear so a dead refresh token cannot block logout / new OTP.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    await supabase.auth.signOut();
  }
}

export { getAccessToken } from './client';
