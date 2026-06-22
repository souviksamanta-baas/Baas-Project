import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../../src/navigation/routes';
import { ConfirmPaymentScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function ConfirmPaymentRoute(): ReactElement {
  const router = useRouter();

  return <ConfirmPaymentScreen onBack={() => router.replace(routes.inventorySell)} />;
}
