import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { createProductDetails } from '../../../src/api/inventory';
import { ScreenContent } from '../../../src/components/ui';
import { InventoryScreenTitle } from '../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useProductCatalog } from '../../../src/context/ProductCatalogProvider';
import { useBusinessCenters } from '../../../src/hooks/useBusinessCenters';
import { collectCategoryOptions, collectSupplierOptions } from '../../../src/lib/productCatalog';
import {
  parseInventoryReturnTo,
  productDetailRoute,
  routes,
} from '../../../src/navigation/routes';
import { AddProductScreen } from '../../../src/screens/inventory/InventoryScreens';
import type { AddProductFormValues } from '../../../src/types/products';

export default function AddProductRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const businessCenterName = dashboard?.businessCenter?.name ?? null;
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = parseInventoryReturnTo(rawReturnTo);
  const catalog = useProductCatalog();
  const businessCenters = useBusinessCenters();
  const [isSaving, setIsSaving] = useState(false);

  const categories = useMemo(
    () => collectCategoryOptions(catalog.products),
    [catalog.products],
  );

  const suppliers = useMemo(
    () => collectSupplierOptions(catalog.products),
    [catalog.products],
  );

  const goBack = () => {
    if (returnTo === 'product-detail') {
      router.back();
      return;
    }

    router.replace(routes.inventoryManageStock);
  };

  async function persistProduct(values: AddProductFormValues): Promise<string> {
    if (!organizationId) {
      throw new Error('No hay organizacion activa.');
    }

    const targetBusinessCenterId = values.businessCenterId.trim() || businessCenterId;

    if (!targetBusinessCenterId) {
      throw new Error('Selecciona una sucursal.');
    }

    const product = await createProductDetails(
      targetBusinessCenterId,
      organizationId,
      values,
    );

    await catalog.reloadProducts();
    return product.id;
  }

  if (!organizationId || !businessCenterId) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Completa los datos del producto y el stock inicial"
          title="Nuevo producto"
        />
        <Text>No hay sucursal activa.</Text>
      </ScreenContent>
    );
  }

  return (
    <AddProductScreen
      businessCenterId={businessCenterId}
      businessCenters={
        businessCenters.length > 0
          ? businessCenters
          : [{ id: businessCenterId, name: businessCenterName ?? 'Sucursal principal' }]
      }
      categories={categories}
      isSaving={isSaving}
      onBack={goBack}
      suppliers={suppliers}
      onSave={async (values) => {
        setIsSaving(true);

        try {
          const productId = await persistProduct(values);
          router.replace(productDetailRoute(productId, 'manage-stock'));
        } catch (error) {
          Alert.alert(
            'No se pudo guardar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
        } finally {
          setIsSaving(false);
        }
      }}
      onSaveAndAddAnother={async (values) => {
        setIsSaving(true);

        try {
          await persistProduct(values);
        } catch (error) {
          Alert.alert(
            'No se pudo guardar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
          throw error;
        } finally {
          setIsSaving(false);
        }
      }}
    />
  );
}
