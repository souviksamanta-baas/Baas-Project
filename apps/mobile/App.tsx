import type { ReactElement } from 'react';
import { SafeAreaView, ScrollView, Text } from 'react-native';

import { useOwnerSession } from './src/hooks/useOwnerSession';
import type { OwnerSessionState } from './src/hooks/useOwnerSession';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { VerifyOtpScreen } from './src/screens/VerifyOtpScreen';
import { styles } from './src/styles';

export default function App(): ReactElement {
  const ownerSession = useOwnerSession();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>BaaS Phase 0</Text>
        <Text style={styles.title}>Owner Assistant</Text>

        <OwnerRouteView ownerSession={ownerSession} />
      </ScrollView>
    </SafeAreaView>
  );
}

function OwnerRouteView(props: { ownerSession: OwnerSessionState }): ReactElement | null {
  const { ownerSession } = props;

  if (ownerSession.route === 'loading') {
    return <LoadingScreen />;
  }

  if (ownerSession.route === 'login') {
    return (
      <LoginScreen
        canSubmitPhone={ownerSession.canSubmitPhone}
        isSubmitting={ownerSession.isSubmitting}
        onChangePhone={ownerSession.setPhone}
        onRequestOtp={ownerSession.requestOtp}
        phone={ownerSession.phone}
      />
    );
  }

  if (ownerSession.route === 'verify') {
    return (
      <VerifyOtpScreen
        isSubmitting={ownerSession.isSubmitting}
        onChangeOtpCode={ownerSession.setOtpCode}
        onVerifyOtp={ownerSession.verifyOtp}
        otpCode={ownerSession.otpCode}
        phone={ownerSession.phone}
      />
    );
  }

  if (ownerSession.route === 'onboarding') {
    return (
      <OnboardingScreen
        businessName={ownerSession.businessName}
        isSubmitting={ownerSession.isSubmitting}
        onChangeBusinessName={ownerSession.setBusinessName}
        onCreateOrganization={ownerSession.createOrganization}
      />
    );
  }

  if (ownerSession.route === 'dashboard' && ownerSession.dashboard) {
    return <DashboardScreen dashboard={ownerSession.dashboard} onSignOut={ownerSession.signOut} />;
  }

  return null;
}
