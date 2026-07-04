import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useProducts } from '../../../src/hooks/useProducts';
import { mapProductsToInventoryRows } from '../../../src/lib/inventoryPresentation';
import {
  productAddStockRoute,
  productDeleteRoute,
  productDetailRoute,
  productEditRoute,
} from '../../../src/navigation/routes';
import { ManageStockScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function ManageStockRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const catalog = useProducts(organizationId, businessCenterId);
  const products = useMemo(
    () => mapProductsToInventoryRows(catalog.products),
    [catalog.products],
  );

  return (
    <ManageStockScreen
      errorMessage={catalog.errorMessage}
      isLoading={catalog.isLoading}
      onAddStockProduct={(productId) => router.push(productAddStockRoute(productId))}
      onDeleteProduct={(productId) => router.push(productDeleteRoute(productId))}
      onEditProduct={(productId) => router.push(productEditRoute(productId, 'manage-stock'))}
      onOpenProductDetail={(productId) => router.push(productDetailRoute(productId))}
      products={products}
    />
  );
}
