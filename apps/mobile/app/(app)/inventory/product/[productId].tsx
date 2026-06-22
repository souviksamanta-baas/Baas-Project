import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useInventoryNavigation } from '../../../../src/navigation/useInventoryNavigation';
import { routes } from '../../../../src/navigation/routes';
import { ProductDetailScreen } from '../../../../src/screens/inventory/InventoryScreens';

export default function ProductDetailRoute(): ReactElement {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const inventoryNav = useInventoryNavigation(productId);

  return (
    <ProductDetailScreen
      {...inventoryNav}
      onBack={() => router.replace(routes.inventoryManageStock)}
    />
  );
}
