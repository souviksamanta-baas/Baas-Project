import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { ArcaSettingsScreen } from '../../src/screens/ArcaSettingsScreen';
import { LoadingScreen } from '../../src/screens/LoadingScreen';

export default function ArcaSettingsRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organization = dashboard?.organization;

  if (!organization) {
    return <LoadingScreen />;
  }

  return (
    <ArcaSettingsScreen
      onBack={() => router.replace(routes.businessSettings)}
      organizationId={organization.id}
    />
  );
}
