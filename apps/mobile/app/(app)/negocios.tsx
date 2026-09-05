import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { NegociosScreen } from '../../src/screens/NegociosScreen';

export default function NegociosRoute(): ReactElement {
  const router = useRouter();
  const { dashboard, refreshDashboard } = useOwnerSessionContext();

  return (
    <NegociosScreen
      businessName={dashboard?.organization?.name ?? null}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace(routes.account);
      }}
      onOpenCreateOrganization={() => router.push(routes.createOrganization)}
      onOrganizationSwitched={async (organizationId) => {
        await refreshDashboard(organizationId);
      }}
      onSwitchComplete={() => {
        router.replace(routes.appHome);
      }}
      organizationId={dashboard?.organization?.id ?? null}
      role={dashboard?.organization?.role ?? null}
    />
  );
}
