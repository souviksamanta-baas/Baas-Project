import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { createOrganizationWithOwner, getOwnerDashboard } from '../features/onboarding';
import { supabase } from '../lib/supabase';
import { requestEmailOtp, signOutOwner, verifyEmailOtp } from '../services/auth';
import { normalizeEmail } from '../services/email';
import type { OwnerDashboard } from '../types/dashboard';

export type OwnerRoute = 'loading' | 'login' | 'verify' | 'onboarding' | 'dashboard';

export interface OwnerSessionState {
  businessName: string;
  canSubmitEmail: boolean;
  dashboard: OwnerDashboard | null;
  email: string;
  isSubmitting: boolean;
  otpCode: string;
  requestOtp: () => Promise<void>;
  route: OwnerRoute;
  setBusinessName: (businessName: string) => void;
  setEmail: (email: string) => void;
  setOtpCode: (otpCode: string) => void;
  createOrganization: () => Promise<void>;
  signOut: () => Promise<void>;
  verifyOtp: () => Promise<void>;
}

export function useOwnerSession(): OwnerSessionState {
  const [route, setRoute] = useState<OwnerRoute>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmitEmail = useMemo(() => normalizeEmail(email) !== null, [email]);

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
    if (!canSubmitEmail) {
      Alert.alert('Use email format', 'Enter an email address like owner@example.com.');
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedEmail = normalizeEmail(email);
      await requestEmailOtp(email);
      setEmail(normalizedEmail ?? email);
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
      await verifyEmailOtp({ email, otpCode });
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
    canSubmitEmail,
    dashboard,
    email,
    isSubmitting,
    otpCode,
    requestOtp,
    route,
    setBusinessName,
    setEmail,
    setOtpCode,
    createOrganization,
    signOut,
    verifyOtp,
  };
}
