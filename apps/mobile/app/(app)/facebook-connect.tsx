import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { FacebookConnectScreen } from '../../src/screens/FacebookConnectScreen';

export default function FacebookConnectRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();
  const organizationId = session.dashboard?.organization?.id;
  const connection = session.dashboard?.facebookConnection ?? null;

  if (!organizationId) {
    router.back();
    return null as unknown as ReactElement;
  }

  return (
    <FacebookConnectScreen
      connection={connection}
      onBack={() => router.back()}
      onConnected={session.refreshDashboard}
      organizationId={organizationId}
    />
  );
}
