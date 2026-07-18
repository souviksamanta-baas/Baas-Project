import type { ReactElement } from 'react';
import { SafeAreaView, ScrollView, Text } from 'react-native';

import { useOwnerSession } from './src/hooks/useOwnerSession';
import type { AuthPhase, OwnerSessionState } from './src/hooks/useOwnerSession';
import { hasSupabaseConfig } from './src/lib/supabase';
import { OwnerAppNavigator } from './src/navigation/OwnerAppNavigator';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { VerifyOtpScreen } from './src/screens/VerifyOtpScreen';
import { styles } from './src/styles';

export default function App(): ReactElement {
  const ownerSession = useOwnerSession();
  const isDashboardRoute = ownerSession.authPhase === 'authenticated' && ownerSession.dashboard;

  return (
    <SafeAreaView style={styles.safeArea}>
      {!hasSupabaseConfig ? (
        <OwnerAppNavigator onSignOut={() => undefined} />
      ) : isDashboardRoute ? (
        <OwnerRouteView ownerSession={ownerSession} />
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.eyebrow}>BaaS Phase 0</Text>
          <Text style={styles.title}>Owner Assistant</Text>
          <OwnerRouteView ownerSession={ownerSession} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function OwnerRouteView(props: { ownerSession: OwnerSessionState }): ReactElement | null {
  const { ownerSession } = props;
  const route = authPhaseToRoute(ownerSession.authPhase);

  if (route === 'loading') {
    return <LoadingScreen />;
  }

  if (route === 'login') {
    return (
      <LoginScreen
        authError={ownerSession.authError}
        canSubmitLogin={ownerSession.canSubmitLogin}
        channel={ownerSession.otpChannel}
        isSubmitting={ownerSession.isSubmitting}
        loginIdentifier={ownerSession.loginIdentifier}
        onChangeLoginIdentifier={ownerSession.setLoginIdentifier}
        onRequestOtp={ownerSession.requestOtp}
      />
    );
  }

  if (route === 'verify') {
    return (
      <VerifyOtpScreen
        channel={ownerSession.otpChannel}
        destination={ownerSession.loginIdentifier}
        isSubmitting={ownerSession.isSubmitting}
        onChangeOtpCode={ownerSession.setOtpCode}
        onResendOtp={ownerSession.requestOtp}
        onVerifyOtp={ownerSession.verifyOtp}
        otpCode={ownerSession.otpCode}
      />
    );
  }

  if (route === 'onboarding') {
    return (
      <OnboardingScreen
        businessName={ownerSession.businessName}
        isSubmitting={ownerSession.isSubmitting}
        onChangeBusinessName={ownerSession.setBusinessName}
        onCreateOrganization={ownerSession.createOrganization}
      />
    );
  }

  if (route === 'dashboard' && ownerSession.dashboard) {
    return <DashboardScreen dashboard={ownerSession.dashboard} onSignOut={ownerSession.signOut} />;
  }

  return null;
}

function authPhaseToRoute(
  authPhase: AuthPhase,
): 'loading' | 'login' | 'verify' | 'onboarding' | 'dashboard' {
  switch (authPhase) {
    case 'loading':
      return 'loading';
    case 'unauthenticated':
      return 'login';
    case 'pending_verify':
      return 'verify';
    case 'onboarding':
      return 'onboarding';
    case 'authenticated':
      return 'dashboard';
  }
}
