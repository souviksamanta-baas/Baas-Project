import { Redirect, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { setAuthEntryIntent } from '../../src/services/authIntent';
import { DEFAULT_AUTH_OTP_CHANNEL } from '../../src/services/authChannel';
import { LoadingScreen } from '../../src/screens/LoadingScreen';
import { WelcomeIntentScreen } from '../../src/screens/WelcomeIntentScreen';

export default function WelcomeRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();

  if (session.authPhase === 'loading') {
    return <LoadingScreen />;
  }

  if (session.authPhase === 'pending_verify') {
    return <Redirect href={routes.authVerify} />;
  }

  if (session.authPhase === 'onboarding') {
    return <Redirect href={routes.authOnboarding} />;
  }

  if (session.authPhase === 'authenticated') {
    return <Redirect href={routes.appHome} />;
  }

  return (
    <WelcomeIntentScreen
      onCreateBusiness={() => {
        setAuthEntryIntent('create');
        session.setOtpChannel(DEFAULT_AUTH_OTP_CHANNEL);
        router.push(routes.authLogin);
      }}
      onJoinWithInviteToken={(inviteToken) => {
        router.replace({
          pathname: routes.staffInviteAccept,
          params: { token: inviteToken },
        });
      }}
      onSignIn={() => {
        setAuthEntryIntent('signin');
        router.push(routes.authLogin);
      }}
    />
  );
}
