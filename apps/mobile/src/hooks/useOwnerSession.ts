import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { createOrganizationWithOwner, getOwnerDashboard } from '../features/onboarding';
import { supabase } from '../lib/supabase';
import { requestEmailOtp, signOutOwner, verifyEmailOtp } from '../services/auth';
import { normalizeEmail } from '../services/email';
import type { OwnerDashboard } from '../types/dashboard';

export type AuthPhase = 'loading' | 'unauthenticated' | 'pending_verify' | 'onboarding' | 'authenticated';

export interface OwnerSessionState {
  authPhase: AuthPhase;
  businessName: string;
  canSubmitEmail: boolean;
  dashboard: OwnerDashboard | null;
  email: string;
  isSubmitting: boolean;
  otpCode: string;
  requestOtp: () => Promise<boolean>;
  setBusinessName: (businessName: string) => void;
  setEmail: (email: string) => void;
  setOtpCode: (otpCode: string) => void;
  createOrganization: () => Promise<void>;
  signOut: () => Promise<void>;
  verifyOtp: () => Promise<void>;
}

export function useOwnerSession(): OwnerSessionState {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const canSubmitEmail = useMemo(() => normalizeEmail(email) !== null, [email]);

  const bootstrapRoute = useCallback(async (nextSession: Session | null): Promise<void> => {
    if (!nextSession) {
      setDashboard(null);
      return;
    }

    const nextDashboard = await getOwnerDashboard();
    setDashboard(nextDashboard);
    setOtpSent(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      void bootstrapRoute(data.session).finally(() => {
        if (mounted) {
          setBootstrapped(true);
        }
      });
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

  const authPhase = useMemo((): AuthPhase => {
    if (!bootstrapped) {
      return 'loading';
    }

    if (!session) {
      return otpSent ? 'pending_verify' : 'unauthenticated';
    }

    if (dashboard?.shouldOnboard) {
      return 'onboarding';
    }

    return 'authenticated';
  }, [bootstrapped, dashboard?.shouldOnboard, otpSent, session]);

  async function requestOtp(): Promise<boolean> {
    if (!canSubmitEmail) {
      Alert.alert('Use email format', 'Enter an email address like owner@example.com.');
      return false;
    }

    setIsSubmitting(true);

    try {
      const normalizedEmail = normalizeEmail(email);
      await requestEmailOtp(email);
      setEmail(normalizedEmail ?? email);
      setOtpSent(true);
      return true;
    } catch (error) {
      Alert.alert('Could not send code', error instanceof Error ? error.message : 'Unknown error');
      return false;
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
    setOtpSent(false);
    await signOutOwner();
  }

  return {
    authPhase,
    businessName,
    canSubmitEmail,
    dashboard,
    email,
    isSubmitting,
    otpCode,
    requestOtp,
    setBusinessName,
    setEmail,
    setOtpCode,
    createOrganization,
    signOut,
    verifyOtp,
  };
}
