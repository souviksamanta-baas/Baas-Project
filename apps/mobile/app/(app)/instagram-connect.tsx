import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { InstagramConnectScreen } from '../../src/screens/InstagramConnectScreen';

export default function InstagramConnectRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();
  const organizationId = session.dashboard?.organization?.id;
  const connection = session.dashboard?.instagramConnection ?? null;

  if (!organizationId) {
    router.back();
    return null as unknown as ReactElement;
  }

  return (
    <InstagramConnectScreen
      connection={connection}
      onBack={() => router.back()}
      onConnected={session.refreshDashboard}
      organizationId={organizationId}
    />
  );
}
