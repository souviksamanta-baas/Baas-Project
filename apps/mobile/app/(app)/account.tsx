import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { AccountScreen } from '../../src/screens/AccountScreen';

export default function AccountRoute(): ReactElement {
  const router = useRouter();
  const { dashboard, signOut } = useOwnerSessionContext();

  return (
    <AccountScreen
      businessCenterName={dashboard?.businessCenter?.name ?? null}
      businessName={dashboard?.organization?.name ?? null}
      onOpenWhatsAppSetup={() => router.push(routes.whatsappConnect)}
      onSignOut={signOut}
      role={dashboard?.organization?.role ?? null}
      whatsappConnection={dashboard?.whatsappConnection ?? null}
    />
  );
}
