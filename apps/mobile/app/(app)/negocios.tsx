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
      onBack={() => router.back()}
      onOpenCreateOrganization={() => router.push(routes.createOrganization)}
      onOrganizationSwitched={refreshDashboard}
      organizationId={dashboard?.organization?.id ?? null}
      role={dashboard?.organization?.role ?? null}
    />
  );
}
