import { Redirect } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../src/context/OwnerSessionProvider';
import { hasSupabaseConfig } from '../src/lib/supabase';
import { routes } from '../src/navigation/routes';
import { LoadingScreen } from '../src/screens/LoadingScreen';

export default function RootIndexRoute(): ReactElement {
  const { authPhase } = useOwnerSessionContext();

  if (!hasSupabaseConfig) {
    return <Redirect href={routes.appHome} />;
  }

  if (authPhase === 'loading') {
    return <LoadingScreen />;
  }

  if (authPhase === 'unauthenticated') {
    return <Redirect href={routes.authLogin} />;
  }

  if (authPhase === 'pending_verify') {
    return <Redirect href={routes.authVerify} />;
  }

  if (authPhase === 'onboarding') {
    return <Redirect href={routes.authOnboarding} />;
  }

  return <Redirect href={routes.appHome} />;
}
