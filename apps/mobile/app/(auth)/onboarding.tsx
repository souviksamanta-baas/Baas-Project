import { Redirect, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { getAuthEntryIntent } from '../../src/services/authIntent';
import { LoadingScreen } from '../../src/screens/LoadingScreen';
import { OnboardingScreen } from '../../src/screens/OnboardingScreen';

export default function OnboardingRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();
  const intent = getAuthEntryIntent();
  const initialStep = intent === 'create' ? 'create' : 'choice';

  if (session.authPhase === 'loading') {
    return <LoadingScreen />;
  }

  if (session.authPhase === 'authenticated') {
    return <Redirect href={routes.appHome} />;
  }

  if (session.authPhase !== 'onboarding') {
    return <Redirect href={routes.authWelcome} />;
  }

  return (
    <OnboardingScreen
      businessName={session.businessName}
      featureFlags={session.featureFlags}
      initialStep={initialStep}
      isSubmitting={session.isSubmitting}
      navShortcut={session.navShortcut}
      onChangeBusinessName={session.setBusinessName}
      onChangeFeatureFlags={session.setFeatureFlags}
      onChangeNavShortcut={session.setNavShortcut}
      onChangeVerticalId={session.setVerticalId}
      onCreateOrganization={() => {
        void session.createOrganization();
      }}
      onJoinWithInviteToken={(inviteToken) => {
        router.replace({
          pathname: routes.staffInviteAccept,
          params: { token: inviteToken },
        });
      }}
      onSignOut={() => {
        void session.signOut();
      }}
      verticalId={session.verticalId}
    />
  );
}
