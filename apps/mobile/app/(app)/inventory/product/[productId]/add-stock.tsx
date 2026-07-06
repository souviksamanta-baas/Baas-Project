import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { addStock } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
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

  async function persistStock(values: AddStockFormValues): Promise<void> {
    const orgId = organizationId ?? contextOrganizationId;
    const centerId = businessCenterId ?? contextBusinessCenterId;

    if (!orgId || !centerId) {
      throw new Error('No se pudo resolver la sucursal activa.');
    }

    const targetProduct = catalogProducts.find((item) => item.id === values.targetProductId);

    if (!targetProduct) {
      throw new Error('Producto no encontrado.');
    }

    await addStock(centerId, orgId, targetProduct, values);
    await reloadProducts();
  }

  if (isLoading && selectableProducts.length === 0) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={() => router.back()}
          subtitle="Registra ingresos para el producto base o sus subproductos"
          title="Agregar stock"
        />
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
          productId: routeProductId ?? '',
          returnTo,
        })
      }
      onSave={async (values) => {
        setIsSaving(true);

        try {
          await persistStock(values);
          navigateInventoryReturn(router, {
            productId: routeProductId ?? '',
            returnTo,
          });
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
        setIsSaving(true);

        try {
          await persistStock(values);
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
      selectableProducts={selectableProducts}
      showProductSelection={showProductSelection}
    />
  );
}
