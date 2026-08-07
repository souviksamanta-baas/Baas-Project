import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { addStock } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
import { useOptionalLoadPurchase } from '../../../../../src/context/LoadPurchaseProvider';
import { useAddStockContext } from '../../../../../src/hooks/useAddStockContext';
import { useProductCatalog } from '../../../../../src/context/ProductCatalogProvider';
import { navigateInventoryReturn } from '../../../../../src/navigation/inventoryNavigation';
import { parseInventoryReturnTo, routes } from '../../../../../src/navigation/routes';
import { AddStockScreen } from '../../../../../src/screens/inventory/InventoryScreens';
import type { AddStockFormValues } from '../../../../../src/types/inventoryLots';

export default function AddStockRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const { productId: rawProductId, returnTo: rawReturnTo } = useLocalSearchParams<{
    productId: string;
    returnTo?: string | string[];
  }>();
  const returnTo = parseInventoryReturnTo(rawReturnTo);
  const loadPurchase = useOptionalLoadPurchase();
  const isLoadPurchase = returnTo === 'load-purchase';
  const {
    businessCenterId: contextBusinessCenterId,
    defaultSelectedId,
    isLoading,
    organizationId: contextOrganizationId,
    reloadProducts,
    selectableProducts,
    showProductSelection,
  } = useAddStockContext(rawProductId);
  const { products: catalogProducts } = useProductCatalog();
  const [isSaving, setIsSaving] = useState(false);
  const routeProductId = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId;
  const parentOnlyProducts = isLoadPurchase
    ? selectableProducts.filter((product) => product.parentProductId == null)
    : selectableProducts;
  const loadPurchaseProducts =
    parentOnlyProducts.length > 0
      ? parentOnlyProducts
      : catalogProducts.filter((product) => product.id === (defaultSelectedId ?? routeProductId));

  async function persistStock(values: AddStockFormValues): Promise<void> {
    if (isSaving) {
      return;
    }

    const orgId = organizationId ?? contextOrganizationId;
    const centerId = businessCenterId ?? contextBusinessCenterId;

    if (!orgId || !centerId) {
      throw new Error('No se pudo resolver la sucursal activa.');
    }

    const targetProduct = catalogProducts.find((item) => item.id === values.targetProductId);

    if (!targetProduct) {
      throw new Error('Producto no encontrado.');
    }

    if (isLoadPurchase && loadPurchase) {
      loadPurchase.addLine({
        product: targetProduct,
        values: {
          ...values,
          purchaseNumber: loadPurchase.purchaseNumber.trim(),
          receivedDate: loadPurchase.date,
          supplier: loadPurchase.supplier.trim(),
          targetProductId: targetProduct.id,
        },
      });
      return;
    }

    await addStock(centerId, orgId, targetProduct, values);
    await reloadProducts();
  }

  function returnAfterSave(): void {
    navigateInventoryReturn(router, {
      preferBack: !isLoadPurchase,
      productId: routeProductId ?? '',
      returnTo,
    });
  }

  if (isLoading && selectableProducts.length === 0) {
    return (
      <ScreenContent>
        <InventoryScreenTitle onBack={() => router.back()} title="Agregar stock" />
        <Text>Cargando producto...</Text>
      </ScreenContent>
    );
  }

  return (
    <AddStockScreen
      catalogProducts={catalogProducts}
      defaultSelectedProductId={defaultSelectedId ?? routeProductId ?? ''}
      isSaving={isSaving}
      onBack={() =>
        navigateInventoryReturn(router, {
          preferBack: !isLoadPurchase,
          productId: routeProductId ?? '',
          returnTo,
        })
      }
      onSave={async (values) => {
        if (isSaving) {
          return;
        }

        setIsSaving(true);

        try {
          await persistStock(values);
          returnAfterSave();
        } catch (error) {
          Alert.alert(
            'No se pudo guardar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
        } finally {
          setIsSaving(false);
        }
      }}
      onSaveAndGoToManageStock={async (values) => {
        if (isSaving) {
          return;
        }

        setIsSaving(true);

        try {
          await persistStock(values);

          if (isLoadPurchase) {
            router.replace(routes.inventoryLoadPurchase);
            return;
          }

          router.replace(routes.inventoryManageStock);
        } catch (error) {
          Alert.alert(
            'No se pudo guardar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
        } finally {
          setIsSaving(false);
        }
      }}
      purchaseDefaults={
        isLoadPurchase && loadPurchase
          ? {
              lockSupplierAndDate: true,
              purchaseNumber: loadPurchase.purchaseNumber.trim(),
              receivedDate: loadPurchase.date,
              supplier: loadPurchase.supplier.trim(),
            }
          : undefined
      }
      selectableProducts={isLoadPurchase ? loadPurchaseProducts : selectableProducts}
      showProductSelection={isLoadPurchase ? false : showProductSelection}
    />
  );
}
