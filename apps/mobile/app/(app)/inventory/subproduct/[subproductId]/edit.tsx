import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { DEFAULT_BASE_PRODUCT_ID, productDetailRoute } from '../../../../../src/navigation/routes';
import { EditSubproductScreen } from '../../../../../src/screens/inventory/InventoryScreens';

export default function EditSubproductRoute(): ReactElement {
  const router = useRouter();
  const { subproductId } = useLocalSearchParams<{ subproductId: string }>();

  void subproductId;

  return (
    <EditSubproductScreen onBack={() => router.replace(productDetailRoute(DEFAULT_BASE_PRODUCT_ID))} />
  );
}
