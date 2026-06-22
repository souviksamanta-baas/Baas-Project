import type { ReactElement } from 'react';

import { useInventoryNavigation } from '../../../src/navigation/useInventoryNavigation';
import { SellProductsScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function SellProductsRoute(): ReactElement {
  const inventoryNav = useInventoryNavigation();

  return <SellProductsScreen {...inventoryNav} />;
}
