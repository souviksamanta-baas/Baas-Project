import type { ReactElement } from 'react';

import { useInventoryNavigation } from '../../../src/navigation/useInventoryNavigation';
import { ManageStockScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function ManageStockRoute(): ReactElement {
  const inventoryNav = useInventoryNavigation();

  return <ManageStockScreen {...inventoryNav} />;
}
