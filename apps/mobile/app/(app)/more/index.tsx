import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import type { MoreMenuRowId } from '../../../src/lib/moreMenu';
import {
  productAddRoute,
  routes,
} from '../../../src/navigation/routes';
import { MoreScreen } from '../../../src/screens/MoreScreen';

export default function MoreRoute(): ReactElement {
  const router = useRouter();

  function openRow(rowId: MoreMenuRowId): void {
    switch (rowId) {
      case 'manage-stock':
        router.push(routes.inventoryManageStock);
        return;
      case 'add-product':
        router.push(productAddRoute('manage-stock'));
        return;
      case 'lots-movements':
        router.push(routes.inventoryLotsMovements);
        return;
      case 'notifications-tasks':
        router.push(routes.tasks);
        return;
      case 'billing':
        router.push(routes.billing);
        return;
      case 'account':
        router.push(routes.account);
        return;
      case 'integrations':
        router.push(routes.integrations);
        return;
      case 'suppliers':
        router.push(routes.suppliers);
        return;
      case 'help':
        router.push(routes.helpSupport);
        return;
      case 'cash':
      case 'reports-soon':
      default:
        return;
    }
  }

  return <MoreScreen onOpenRow={openRow} />;
}
