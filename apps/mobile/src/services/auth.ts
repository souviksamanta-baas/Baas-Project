import { supabase } from '../lib/supabase';
import { getAuthOtpChannel } from './authChannel';
import { normalizeEmail } from './email';
import { normalizePhoneNumber } from './phone';

export async function requestEmailOtp(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Enter a valid email address.');
  }

  const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail });

  if (error) {
    throw new Error(error.message);
  }
}

export async function verifyEmailOtp(params: {
  email: string;
  otpCode: string;
}): Promise<void> {
  const normalizedEmail = normalizeEmail(params.email);

  if (!normalizedEmail) {
    throw new Error('Enter a valid email address.');
  }

  const { error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: params.otpCode.trim(),
    type: 'email',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function requestPhoneOtp(phone: string): Promise<void> {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    throw new Error('Enter a valid phone number in international format (e.g. +54911…).');
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
    throw new Error('Enter a valid phone number in international format (e.g. +54911…).');
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

export async function requestLoginOtp(identifier: string): Promise<void> {
  if (getAuthOtpChannel() === 'sms') {
    await requestPhoneOtp(identifier);
    return;
  }

  await requestEmailOtp(identifier);
}

export async function verifyLoginOtp(params: {
  identifier: string;
  otpCode: string;
}): Promise<void> {
  if (getAuthOtpChannel() === 'sms') {
    await verifyPhoneOtp({ phone: params.identifier, otpCode: params.otpCode });
    return;
  }

  await verifyEmailOtp({ email: params.identifier, otpCode: params.otpCode });
}

export async function signOutOwner(): Promise<void> {
  await supabase.auth.signOut();
}
