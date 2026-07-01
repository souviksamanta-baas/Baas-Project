import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { createOrganizationWithOwner, getOwnerDashboard } from '../api/dashboard';
import { requestLoginOtp, signOutOwner, verifyLoginOtp } from '../api/auth';
import { supabase } from '../lib/supabase';
import { formatAuthError } from '../services/authErrors';
import {
  DEFAULT_AUTH_OTP_CHANNEL,
  isPhoneAuthChannel,
  type AuthOtpChannel,
} from '../services/authChannel';
import { normalizeEmail } from '../services/email';
import { normalizePhoneNumber } from '../services/phone';
import type { OwnerDashboard } from '../types/dashboard';

export type AuthPhase = 'loading' | 'unauthenticated' | 'pending_verify' | 'onboarding' | 'authenticated';

export interface OwnerSessionState {
  authError: string | null;
  authPhase: AuthPhase;
  businessName: string;
  canSubmitLogin: boolean;
  dashboard: OwnerDashboard | null;
  isSubmitting: boolean;
  loginIdentifier: string;
  otpChannel: AuthOtpChannel;
  otpCode: string;
  requestOtp: () => Promise<boolean>;
  setBusinessName: (businessName: string) => void;
  setLoginIdentifier: (loginIdentifier: string) => void;
  setOtpChannel: (channel: AuthOtpChannel) => void;
  setOtpCode: (otpCode: string) => void;
  createOrganization: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  signOut: () => Promise<void>;
  verifyOtp: () => Promise<void>;
}

export function useOwnerSession(): OwnerSessionState {
  const [otpChannel, setOtpChannel] = useState<AuthOtpChannel>(DEFAULT_AUTH_OTP_CHANNEL);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [isResolvingDashboard, setIsResolvingDashboard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const canSubmitLogin = useMemo(() => {
    if (isPhoneAuthChannel(otpChannel)) {
      return normalizePhoneNumber(loginIdentifier) !== null;
    }

    return normalizeEmail(loginIdentifier) !== null;
  }, [loginIdentifier, otpChannel]);

  const bootstrapRoute = useCallback(async (nextSession: Session | null): Promise<void> => {
    if (!nextSession) {
      setDashboard(null);
      setIsResolvingDashboard(false);
      return;
    }

    setIsResolvingDashboard(true);

    try {
      const nextDashboard = await getOwnerDashboard();
      setDashboard(nextDashboard);
      setOtpSent(false);
    } finally {
      setIsResolvingDashboard(false);
    }
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
    if (!bootstrapped || isResolvingDashboard) {
      return 'loading';
    }

    if (!session) {
      return otpSent ? 'pending_verify' : 'unauthenticated';
    }

    if (dashboard?.shouldOnboard) {
      return 'onboarding';
    }

    return 'authenticated';
  }, [bootstrapped, dashboard?.shouldOnboard, isResolvingDashboard, otpSent, session]);

  async function requestOtp(): Promise<boolean> {
    if (!canSubmitLogin) {
      Alert.alert(
        isPhoneAuthChannel(otpChannel) ? 'Número inválido' : 'Correo inválido',
        isPhoneAuthChannel(otpChannel)
          ? 'Ingresá tu número como +5411…, +54911… o 011….'
          : 'Ingresá un correo como dueño@ejemplo.com.',
      );
      return false;
    }

    setIsSubmitting(true);
    setAuthError(null);

    try {
      const normalizedIdentifier = isPhoneAuthChannel(otpChannel)
        ? (normalizePhoneNumber(loginIdentifier) ?? loginIdentifier)
        : (normalizeEmail(loginIdentifier) ?? loginIdentifier);

      await requestLoginOtp({ channel: otpChannel, identifier: loginIdentifier });
      setLoginIdentifier(normalizedIdentifier);
      setOtpSent(true);
      return true;
    } catch (error) {
      const message = formatAuthError(error);
      setAuthError(message);
      Alert.alert('No se pudo enviar el código', message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyOtp(): Promise<void> {
    setIsSubmitting(true);

    try {
      await verifyLoginOtp({
        channel: otpChannel,
        identifier: loginIdentifier,
        otpCode,
      });
      const { data } = await supabase.auth.getSession();
      await bootstrapRoute(data.session);
    } catch (error) {
      const message = formatAuthError(error);
      Alert.alert('No se pudo verificar el código', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createOrganization(): Promise<void> {
    if (!businessName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresá el nombre de tu negocio para continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createOrganizationWithOwner(businessName.trim());
      await bootstrapRoute(session);
    } catch (error) {
      Alert.alert(
        'No se pudo crear el negocio',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function refreshDashboard(): Promise<void> {
    const { data } = await supabase.auth.getSession();
    await bootstrapRoute(data.session);
  }

  async function signOut(): Promise<void> {
    setOtpSent(false);
    await signOutOwner();
  }

  function handleSetLoginIdentifier(value: string): void {
    setAuthError(null);
    setLoginIdentifier(value);
  }

  function handleSetOtpChannel(channel: AuthOtpChannel): void {
    setAuthError(null);
    setOtpChannel(channel);
  }

  return {
    authError,
    authPhase,
    businessName,
    canSubmitLogin,
    dashboard,
    isSubmitting,
    loginIdentifier,
    otpChannel,
    otpCode,
    requestOtp,
    setBusinessName,
    setLoginIdentifier: handleSetLoginIdentifier,
    setOtpChannel: handleSetOtpChannel,
    setOtpCode,
    createOrganization,
    refreshDashboard,
    signOut,
    verifyOtp,
  };
}
