import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { clearAuthEntryIntent } from '../services/authIntent';
import { createOrganizationWithOwner, getOwnerDashboard } from '../api/dashboard';
import { requestLoginOtp, signOutOwner, verifyLoginOtp } from '../api/auth';
import { normalizeNavShortcutId, type NavShortcutId } from '../lib/navShortcut';
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
import {
  DEFAULT_ORGANIZATION_FEATURE_FLAGS,
  resolveOrganizationFeatureFlags,
  type OrganizationFeatureFlags,
} from '../types/features';

/** Only definitive Auth failures should wipe the local session. */
function isDefinitiveAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return (
    normalized.includes('user not found') ||
    normalized.includes('user_not_found') ||
    normalized.includes('invalid refresh token') ||
    normalized.includes('refresh_token_not_found') ||
    normalized.includes('session_not_found') ||
    normalized.includes('auth session missing') ||
    normalized.includes('not authenticated') ||
    normalized.includes('invalid claim')
  );
}

export type AuthPhase = 'loading' | 'unauthenticated' | 'pending_verify' | 'onboarding' | 'authenticated';

export interface OwnerSessionState {
  authError: string | null;
  authPhase: AuthPhase;
  businessName: string;
  canSubmitLogin: boolean;
  dashboard: OwnerDashboard | null;
  featureFlags: OrganizationFeatureFlags;
  isSubmitting: boolean;
  loginIdentifier: string;
  navShortcut: NavShortcutId;
  otpChannel: AuthOtpChannel;
  otpCode: string;
  verticalId: string | null;
  requestOtp: () => Promise<boolean>;
  setBusinessName: (businessName: string) => void;
  setFeatureFlags: (featureFlags: OrganizationFeatureFlags) => void;
  setLoginIdentifier: (loginIdentifier: string) => void;
  setNavShortcut: (navShortcut: NavShortcutId) => void;
  setOtpChannel: (channel: AuthOtpChannel) => void;
  setOtpCode: (otpCode: string) => void;
  setVerticalId: (verticalId: string | null) => void;
  createOrganization: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  signOut: () => Promise<void>;
  verifyOtp: () => Promise<void>;
}

function initialFeatureFlags(): OrganizationFeatureFlags {
  return { ...DEFAULT_ORGANIZATION_FEATURE_FLAGS };
}

export function useOwnerSession(): OwnerSessionState {
  const [otpChannel, setOtpChannel] = useState<AuthOtpChannel>(DEFAULT_AUTH_OTP_CHANNEL);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [navShortcut, setNavShortcut] = useState<NavShortcutId>('ventas');
  const [verticalId, setVerticalId] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<OrganizationFeatureFlags>(initialFeatureFlags);
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

  const clearLocalSession = useCallback(async (): Promise<void> => {
    setSession(null);
    setDashboard(null);
    setOtpSent(false);
    clearAuthEntryIntent();
    await signOutOwner();
  }, []);

  const bootstrapRoute = useCallback(async (
    nextSession: Session | null,
    options?: { silent?: boolean },
  ): Promise<void> => {
    if (!nextSession) {
      setDashboard(null);
      setIsResolvingDashboard(false);
      return;
    }

    const silent = options?.silent === true;
    if (!silent) {
      setIsResolvingDashboard(true);
    }

    try {
      // getSession can keep a zombie JWT after the Auth user was deleted (member remove).
      // getUser() hits the Auth server and fails for purged accounts.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        if (isDefinitiveAuthFailure(userError)) {
          await clearLocalSession();
          return;
        }
        // Transient/network errors must not force re-login on every cold start.
      } else if (!userData.user) {
        await clearLocalSession();
        return;
      }

      const nextDashboard = await getOwnerDashboard();
      setDashboard(nextDashboard);
      setOtpSent(false);
    } catch (error) {
      if (isDefinitiveAuthFailure(error)) {
        setDashboard(null);
        await clearLocalSession();
      }
      // Keep existing dashboard/session on transient failures (offline, timeout).
    } finally {
      if (!silent) {
        setIsResolvingDashboard(false);
      }
    }
  }, [clearLocalSession]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      if (error) {
        if (isDefinitiveAuthFailure(error)) {
          await clearLocalSession();
        }
        setBootstrapped(true);
        return;
      }

      setSession(data.session);
      void bootstrapRoute(data.session).finally(() => {
        if (mounted) {
          setBootstrapped(true);
        }
      });
    })();

    void supabase.auth.startAutoRefresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      // USER_UPDATED (e.g. avatar/profile metadata) must not flip auth to loading
      // or the navigation stack resets back to Home.
      if (event === 'USER_UPDATED') {
        return;
      }

      // TOKEN_REFRESHED / SIGNED_IN / etc.: re-check membership + Auth user existence.
      void bootstrapRoute(nextSession, { silent: event === 'TOKEN_REFRESHED' });
    });

    const onAppStateChange = (status: AppStateStatus): void => {
      if (status === 'active') {
        void supabase.auth.startAutoRefresh();
        void (async () => {
          const { data } = await supabase.auth.getSession();
          if (!mounted || !data.session) {
            return;
          }

          await bootstrapRoute(data.session, { silent: true });
        })();
        return;
      }

      void supabase.auth.stopAutoRefresh();
    };

    const appStateSubscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [bootstrapRoute, clearLocalSession]);

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

  const requestOtp = useCallback(async (): Promise<boolean> => {
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

      // Ensure a stale SecureStore session on device does not interfere with a new login.
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        await signOutOwner();
      }

      await requestLoginOtp({ channel: otpChannel, identifier: loginIdentifier });
      setLoginIdentifier(normalizedIdentifier);
      setOtpCode('');
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
  }, [canSubmitLogin, loginIdentifier, otpChannel]);

  const verifyOtp = useCallback(async (): Promise<void> => {
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
  }, [bootstrapRoute, loginIdentifier, otpChannel, otpCode]);

  const createOrganization = useCallback(async (): Promise<void> => {
    if (!businessName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresá el nombre de tu negocio para continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createOrganizationWithOwner(businessName.trim(), {
        featureFlags: resolveOrganizationFeatureFlags(featureFlags),
        navShortcut,
        verticalId,
      });
      clearAuthEntryIntent();
      await bootstrapRoute(session);
    } catch (error) {
      Alert.alert(
        'No se pudo crear el negocio',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [bootstrapRoute, businessName, featureFlags, navShortcut, session, verticalId]);

  const refreshDashboard = useCallback(async (): Promise<void> => {
    const { data } = await supabase.auth.getSession();
    await bootstrapRoute(data.session, { silent: true });
  }, [bootstrapRoute]);

  const signOut = useCallback(async (): Promise<void> => {
    setAuthError(null);
    setOtpCode('');
    setOtpSent(false);
    setBusinessName('');
    setNavShortcut('ventas');
    setVerticalId(null);
    setFeatureFlags(initialFeatureFlags());
    clearAuthEntryIntent();
    await signOutOwner();
  }, []);

  const handleSetLoginIdentifier = useCallback((value: string): void => {
    setAuthError(null);
    setLoginIdentifier(value);
  }, []);

  const handleSetOtpChannel = useCallback((channel: AuthOtpChannel): void => {
    setAuthError(null);
    setOtpChannel(channel);
  }, []);

  const handleSetNavShortcut = useCallback((value: NavShortcutId): void => {
    setNavShortcut(normalizeNavShortcutId(value));
  }, []);

  const handleSetVerticalId = useCallback((value: string | null): void => {
    setVerticalId(value && value.length > 0 ? value : null);
  }, []);

  const handleSetFeatureFlags = useCallback((next: OrganizationFeatureFlags): void => {
    setFeatureFlags(resolveOrganizationFeatureFlags(next));
  }, []);

  return useMemo(
    (): OwnerSessionState => ({
      authError,
      authPhase,
      businessName,
      canSubmitLogin,
      createOrganization,
      dashboard,
      featureFlags,
      isSubmitting,
      loginIdentifier,
      navShortcut,
      otpChannel,
      otpCode,
      refreshDashboard,
      requestOtp,
      setBusinessName,
      setFeatureFlags: handleSetFeatureFlags,
      setLoginIdentifier: handleSetLoginIdentifier,
      setNavShortcut: handleSetNavShortcut,
      setOtpChannel: handleSetOtpChannel,
      setOtpCode,
      setVerticalId: handleSetVerticalId,
      signOut,
      verifyOtp,
      verticalId,
    }),
    [
      authError,
      authPhase,
      businessName,
      canSubmitLogin,
      createOrganization,
      dashboard,
      featureFlags,
      handleSetFeatureFlags,
      handleSetLoginIdentifier,
      handleSetNavShortcut,
      handleSetOtpChannel,
      handleSetVerticalId,
      isSubmitting,
      loginIdentifier,
      navShortcut,
      otpChannel,
      otpCode,
      refreshDashboard,
      requestOtp,
      signOut,
      verifyOtp,
      verticalId,
    ],
  );
}
