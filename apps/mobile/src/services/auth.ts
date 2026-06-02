import { supabase } from '../lib/supabase';

export async function requestPhoneOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });

  if (error) {
    throw new Error(error.message);
  }
}

export async function verifyPhoneOtp(params: {
  otpCode: string;
  phone: string;
}): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    phone: params.phone.trim(),
    token: params.otpCode.trim(),
    type: 'sms',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOutOwner(): Promise<void> {
  await supabase.auth.signOut();
}
