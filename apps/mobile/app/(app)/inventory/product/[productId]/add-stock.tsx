import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { productDetailRoute } from '../../../../../src/navigation/routes';
import { AddStockScreen } from '../../../../../src/screens/inventory/InventoryScreens';

export default function AddStockRoute(): ReactElement {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();

  return <AddStockScreen onBack={() => router.replace(productDetailRoute(productId))} />;
}
