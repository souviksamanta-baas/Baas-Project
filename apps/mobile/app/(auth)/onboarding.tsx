import { Redirect } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { OnboardingScreen } from '../../src/screens/OnboardingScreen';

export default function OnboardingRoute(): ReactElement {
  const session = useOwnerSessionContext();

  if (session.authPhase === 'authenticated') {
    return <Redirect href={routes.appHome} />;
  }

  if (session.authPhase !== 'onboarding') {
    return <Redirect href={routes.authLogin} />;
  }

  return (
    <OnboardingScreen
      businessName={session.businessName}
      isSubmitting={session.isSubmitting}
      onChangeBusinessName={session.setBusinessName}
      onCreateOrganization={session.createOrganization}
    />
  );
}
