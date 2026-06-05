import { supabase } from '../lib/supabase';
import { normalizeEmail } from './email';

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

export async function signOutOwner(): Promise<void> {
  await supabase.auth.signOut();
}
