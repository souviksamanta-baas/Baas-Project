import { Redirect, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { LoginScreen } from '../../src/screens/LoginScreen';

export default function LoginRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();

  if (session.authPhase === 'pending_verify') {
    return <Redirect href={routes.authVerify} />;
  }

  return (
    <LoginScreen
      authError={session.authError}
      canSubmitLogin={session.canSubmitLogin}
      channel={session.otpChannel}
      isSubmitting={session.isSubmitting}
      loginIdentifier={session.loginIdentifier}
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
