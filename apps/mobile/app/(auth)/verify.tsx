import { Redirect } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { VerifyOtpScreen } from '../../src/screens/VerifyOtpScreen';

export default function VerifyRoute(): ReactElement {
  const session = useOwnerSessionContext();

  if (session.authPhase === 'unauthenticated') {
    return <Redirect href={routes.authLogin} />;
  }

  if (session.authPhase === 'authenticated') {
    return <Redirect href={routes.appHome} />;
  }

  if (session.authPhase === 'onboarding') {
    return <Redirect href={routes.authOnboarding} />;
  }

  return (
    <VerifyOtpScreen
      email={session.email}
      isSubmitting={session.isSubmitting}
      onChangeOtpCode={session.setOtpCode}
      onVerifyOtp={session.verifyOtp}
      otpCode={session.otpCode}
    />
  );
}
