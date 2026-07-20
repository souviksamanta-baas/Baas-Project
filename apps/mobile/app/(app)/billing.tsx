import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../src/navigation/routes';
import { BillingQuotesScreen } from '../../src/screens/BillingQuotesScreen';

export default function BillingRoute(): ReactElement {
  const router = useRouter();

  return (
    <BillingQuotesScreen
      onBack={() => router.back()}
      onOpenSell={() => {
        // Replace billing so inventory stack mounts on sell (avoids a flash of manage-stock).
        router.replace(routes.inventorySell);
      }}
    />
  );
}
