import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { productDetailRoute } from '../../../../../src/navigation/routes';
import { useInventoryNavigation } from '../../../../../src/navigation/useInventoryNavigation';
import { EditProductScreen } from '../../../../../src/screens/inventory/InventoryScreens';

export default function EditProductRoute(): ReactElement {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const inventoryNav = useInventoryNavigation(productId);

  return (
    <EditProductScreen {...inventoryNav} onBack={() => router.replace(productDetailRoute(productId))} />
  );
}
