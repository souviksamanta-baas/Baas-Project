import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { PrivacyDataScreen } from '../../src/screens/PrivacyDataScreen';

export default function PrivacyDataRoute(): ReactElement {
  const router = useRouter();
  const { dashboard, signOut } = useOwnerSessionContext();

  return (
    <PrivacyDataScreen
      onBack={() => router.back()}
      onSignedOut={signOut}
      organizationId={dashboard?.organization?.id ?? null}
      role={dashboard?.organization?.role ?? null}
    />
  );
}
