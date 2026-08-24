import { useRouter } from 'expo-router';
import { useEffect, type ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { canManageBusinessSettings } from '../../src/lib/orgRoles';
import { routes } from '../../src/navigation/routes';
import { BusinessSettingsScreen } from '../../src/screens/BusinessSettingsScreen';
import { LoadingScreen } from '../../src/screens/LoadingScreen';

export default function BusinessSettingsRoute(): ReactElement {
  const router = useRouter();
  const { dashboard, refreshDashboard } = useOwnerSessionContext();
  const organization = dashboard?.organization;
  const canManage = canManageBusinessSettings(organization?.role);

  useEffect(() => {
    if (organization && !canManage) {
      router.replace(routes.account);
    }
  }, [canManage, organization, router]);

  if (!organization || !canManage) {
    return <LoadingScreen />;
  }

  return (
    <BusinessSettingsScreen
      fallbackName={organization.name}
      fallbackNavShortcut={organization.navShortcut}
      fallbackTimezone={organization.timezone}
      onBack={() => router.replace(routes.account)}
      onOpenArcaSettings={() => router.push(routes.arcaSettings)}
      onSaved={refreshDashboard}
      organizationId={organization.id}
      whatsappPhone={dashboard?.whatsappConnection?.displayPhoneNumber ?? null}
    />
  );
}
