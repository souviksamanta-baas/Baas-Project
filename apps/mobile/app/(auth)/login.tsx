import { Redirect, useRouter } from 'expo-router';
import { useEffect, type ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { getAuthEntryIntent } from '../../src/services/authIntent';
import { DEFAULT_AUTH_OTP_CHANNEL } from '../../src/services/authChannel';
import { LoginScreen } from '../../src/screens/LoginScreen';

export default function LoginRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();
  const intent = getAuthEntryIntent();
  const setOtpChannel = session.setOtpChannel;

  useEffect(() => {
    if (intent === 'create') {
      setOtpChannel(DEFAULT_AUTH_OTP_CHANNEL);
    }
  }, [intent, setOtpChannel]);

  if (session.authPhase === 'pending_verify') {
    return <Redirect href={routes.authVerify} />;
  }

  if (session.authPhase === 'authenticated') {
    return <Redirect href={routes.appHome} />;
  }

  if (session.authPhase === 'onboarding') {
    return <Redirect href={routes.authOnboarding} />;
  }

  return (
    <LoginScreen
      authError={session.authError}
      canSubmitLogin={session.canSubmitLogin}
      channel={session.otpChannel}
      intent={intent}
      isSubmitting={session.isSubmitting}
      loginIdentifier={session.loginIdentifier}
      onBack={() => {
        router.replace(routes.authWelcome);
      }}
      onChangeChannel={session.setOtpChannel}
      onChangeLoginIdentifier={session.setLoginIdentifier}
      onRequestOtp={async () => {
        const sent = await session.requestOtp();
        if (sent) {
          router.push(routes.authVerify);
        }
      }}
    />
  );
}
