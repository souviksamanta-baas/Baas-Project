import { Redirect, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { setAuthEntryIntent } from '../../src/services/authIntent';
import { getDefaultChannelForIntent } from '../../src/services/authChannel';
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

  if (session.authPhase === 'authenticated') {
    return <Redirect href={routes.appHome} />;
  }

  const needsBusiness = session.authPhase === 'onboarding';

  return (
    <WelcomeIntentScreen
      onJoinWithInviteToken={(inviteToken) => {
        router.replace({
          pathname: routes.staffInviteAccept,
          params: { token: inviteToken },
        });
      }}
      onSignIn={
        needsBusiness
          ? undefined
          : () => {
              setAuthEntryIntent('signin');
              session.setOtpChannel(getDefaultChannelForIntent('signin'));
              session.setLoginIdentifier('');
              router.push(routes.authLogin);
            }
      }
      onSignOut={
        needsBusiness
          ? () => {
              void session.signOut();
            }
          : undefined
      }
    />
  );
}
