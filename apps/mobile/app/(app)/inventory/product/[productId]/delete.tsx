import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { productDetailRoute } from '../../../../../src/navigation/routes';
import { DeleteProductScreen } from '../../../../../src/screens/inventory/InventoryScreens';

export default function DeleteProductRoute(): ReactElement {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();

  return <DeleteProductScreen onBack={() => router.replace(productDetailRoute(productId))} />;
}
