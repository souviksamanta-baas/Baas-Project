import { useRouter } from 'expo-router';
import { useEffect, type ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { BusinessSettingsScreen } from '../../src/screens/BusinessSettingsScreen';
import { LoadingScreen } from '../../src/screens/LoadingScreen';

export default function BusinessSettingsRoute(): ReactElement {
  const router = useRouter();
  const { dashboard, refreshDashboard } = useOwnerSessionContext();
  const organization = dashboard?.organization;
  const isOwner = organization?.role === 'owner';

  useEffect(() => {
    if (organization && !isOwner) {
      router.replace(routes.account);
    }
  }, [isOwner, organization, router]);

  if (!organization || !isOwner) {
    return <LoadingScreen />;
  }

  return (
    <BusinessSettingsScreen
      fallbackName={organization.name}
      fallbackTimezone={organization.timezone}
      onBack={() => router.replace(routes.account)}
      onSaved={refreshDashboard}
      organizationId={organization.id}
    />
  );
}
