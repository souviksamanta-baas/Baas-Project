import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { createOrganizationWithOwner, getOwnerDashboard } from '../features/onboarding';
import { supabase } from '../lib/supabase';
import { requestPhoneOtp, signOutOwner, verifyPhoneOtp } from '../services/auth';
import type { OwnerDashboard } from '../types/dashboard';

export type OwnerRoute = 'loading' | 'login' | 'verify' | 'onboarding' | 'dashboard';

export interface OwnerSessionState {
  businessName: string;
  canSubmitPhone: boolean;
  dashboard: OwnerDashboard | null;
  isSubmitting: boolean;
  otpCode: string;
  phone: string;
  requestOtp: () => Promise<void>;
  route: OwnerRoute;
  setBusinessName: (businessName: string) => void;
  setOtpCode: (otpCode: string) => void;
  setPhone: (phone: string) => void;
  createOrganization: () => Promise<void>;
  signOut: () => Promise<void>;
  verifyOtp: () => Promise<void>;
}

export function useOwnerSession(): OwnerSessionState {
  const [route, setRoute] = useState<OwnerRoute>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmitPhone = useMemo(() => phone.trim().startsWith('+'), [phone]);

  const bootstrapRoute = useCallback(async (nextSession: Session | null): Promise<void> => {
    if (!nextSession) {
      setDashboard(null);
      setRoute('login');
      return;
    }

    const nextDashboard = await getOwnerDashboard();
    setDashboard(nextDashboard);
    setRoute(nextDashboard.shouldOnboard ? 'onboarding' : 'dashboard');
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      void bootstrapRoute(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void bootstrapRoute(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [bootstrapRoute]);

  async function requestOtp(): Promise<void> {
    if (!canSubmitPhone) {
      Alert.alert('Use E.164 format', 'Enter a phone number like +15555550100.');
      return;
    }

    setIsSubmitting(true);

    try {
      await requestPhoneOtp(phone);
      setRoute('verify');
    } catch (error) {
      Alert.alert('Could not send code', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyOtp(): Promise<void> {
    setIsSubmitting(true);

    try {
      await verifyPhoneOtp({ phone, otpCode });
    } catch (error) {
      Alert.alert('Could not verify code', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createOrganization(): Promise<void> {
    if (!businessName.trim()) {
      Alert.alert('Business name required', 'Enter your business name to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createOrganizationWithOwner(businessName.trim());
      await bootstrapRoute(session);
    } catch (error) {
      Alert.alert('Could not create business', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut(): Promise<void> {
    await signOutOwner();
  }

  return {
    businessName,
    canSubmitPhone,
    dashboard,
    isSubmitting,
    otpCode,
    phone,
    requestOtp,
    route,
    setBusinessName,
    setOtpCode,
    setPhone,
    createOrganization,
    signOut,
    verifyOtp,
  };
}
