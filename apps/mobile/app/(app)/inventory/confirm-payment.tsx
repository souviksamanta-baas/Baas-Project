import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { ConfirmPaymentScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function ConfirmPaymentRoute(): ReactElement {
  const router = useRouter();

  return <ConfirmPaymentScreen onBack={() => router.back()} />;
}
