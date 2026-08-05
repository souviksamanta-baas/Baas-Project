import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useLoadPurchase } from '../../../src/context/LoadPurchaseProvider';
import { useProducts } from '../../../src/hooks/useProducts';
import { mapProductToInventoryRow } from '../../../src/lib/inventoryPresentation';
import { productAddStockRoute, routes } from '../../../src/navigation/routes';
import { LoadPurchaseScreen } from '../../../src/screens/inventory/LoadPurchaseScreen';

export default function LoadPurchaseRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const catalog = useProducts(organizationId, businessCenterId);
  const purchase = useLoadPurchase();
  const products = useMemo(
    () =>
      catalog.products
        .filter((product) => product.parentProductId == null)
        .sort((left, right) => left.name.localeCompare(right.name, 'es'))
        .map((product) => mapProductToInventoryRow(product, { indent: false, isBase: true })),
    [catalog.products],
  );

  return (
    <LoadPurchaseScreen
      businessCenterId={businessCenterId}
      editingPurchaseId={purchase.editingPurchaseId}
      errorMessage={catalog.errorMessage}
      isLoading={catalog.isLoading}
      isSaving={purchase.isSaving}
      lines={purchase.lines}
      onAddStockProduct={(productId) =>
        router.push(productAddStockRoute(productId, 'load-purchase'))
      }
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace(routes.appMore);
      }}
      onClearDraft={purchase.clearDraft}
      onDateChange={purchase.setDate}
      onPurchaseNumberChange={purchase.setPurchaseNumber}
      onRemoveLine={purchase.removeLine}
      onSavePurchase={purchase.savePurchase}
      onSupplierChange={purchase.setSupplier}
      organizationId={organizationId}
      products={products}
      purchaseDate={purchase.date}
      purchaseNumber={purchase.purchaseNumber}
      purchaseNumberLocked={purchase.isHeaderLocked}
      supplier={purchase.supplier}
      totalCostCents={purchase.totalCostCents}
      totalItems={purchase.totalItems}
    />
  );
}
