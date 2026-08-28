import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../../../src/navigation/routes';
import { PurchaseDetailScreen } from '../../../../src/screens/PurchaseDetailScreen';

export default function PurchaseDetailRoute(): ReactElement {
  const router = useRouter();
  const { purchaseId: rawPurchaseId } = useLocalSearchParams<{
    purchaseId?: string | string[];
  }>();
  const purchaseId = Array.isArray(rawPurchaseId) ? rawPurchaseId[0] : rawPurchaseId;

  return (
    <PurchaseDetailScreen
      onBack={() => router.back()}
      onOpenLoadPurchase={() => router.push(routes.inventoryLoadPurchase)}
      purchaseId={purchaseId ?? ''}
    />
  );
}
