import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useProducts } from '../../../src/hooks/useProducts';
import { mapProductsToSellRows } from '../../../src/lib/inventoryPresentation';
import { useSellNavigation } from '../../../src/navigation/useInventoryNavigation';
import { SellProductsScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function SellProductsRoute(): ReactElement {
  const sellNav = useSellNavigation();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const catalog = useProducts(organizationId, businessCenterId);
  const products = useMemo(() => mapProductsToSellRows(catalog.products), [catalog.products]);

  return (
    <SellProductsScreen
      {...sellNav}
      errorMessage={catalog.errorMessage}
      isLoading={catalog.isLoading}
      products={products}
    />
  );
}
