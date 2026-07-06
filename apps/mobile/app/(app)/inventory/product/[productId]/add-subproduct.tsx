import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { createProductDetails } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
import { useBusinessCenters } from '../../../../../src/hooks/useBusinessCenters';
import { useInventoryProduct } from '../../../../../src/hooks/useInventoryProduct';
import { collectCategoryOptions, isGranelProduct } from '../../../../../src/lib/productCatalog';
import { navigateInventoryReturn } from '../../../../../src/navigation/inventoryNavigation';
import {
  parseInventoryReturnTo,
  productDetailRoute,
} from '../../../../../src/navigation/routes';
import { AddSubproductScreen } from '../../../../../src/screens/inventory/InventoryScreens';
import type { AddProductFormValues } from '../../../../../src/types/products';

export default function AddSubproductRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const businessCenterName = dashboard?.businessCenter?.name ?? null;
  const { productId: rawProductId, returnTo: rawReturnTo } = useLocalSearchParams<{
    productId: string;
    returnTo?: string | string[];
  }>();
  const returnTo = parseInventoryReturnTo(rawReturnTo);
  const routeProductId = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId;
  const { isLoading, product, productId, products, reloadProducts } =
    useInventoryProduct(rawProductId);
  const businessCenters = useBusinessCenters();
  const [isSaving, setIsSaving] = useState(false);

  const categories = useMemo(
    () => collectCategoryOptions(products, product?.category),
    [product?.category, products],
  );

  const parentProductId = productId ?? routeProductId ?? '';
  const goBack = () => {
    const raw = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

    if (raw === 'product-edit') {
      router.replace(`/(app)/inventory/product/${parentProductId}/edit?returnTo=product-detail`);
      return;
    }

    navigateInventoryReturn(router, { productId: parentProductId, returnTo });
  };

  async function persistSubproduct(values: AddProductFormValues): Promise<string> {
    if (!organizationId) {
      throw new Error('No hay organizacion activa.');
    }

    const targetBusinessCenterId = values.businessCenterId.trim() || businessCenterId;

    if (!targetBusinessCenterId) {
      throw new Error('Selecciona una sucursal.');
    }

    const created = await createProductDetails(targetBusinessCenterId, organizationId, values);
    await reloadProducts();
    return created.id;
  }

  if (!parentProductId || !businessCenterId || !organizationId) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Presentacion derivada del producto base"
          title="Nuevo subproducto"
        />
        <Text>Producto base no encontrado.</Text>
      </ScreenContent>
    );
  }

  if (isLoading && !product) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Presentacion derivada del producto base"
          title="Nuevo subproducto"
        />
        <Text>Cargando producto base...</Text>
      </ScreenContent>
    );
  }

  if (!product || product.parentProductId != null || !isGranelProduct(product)) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Presentacion derivada del producto base"
          title="Nuevo subproducto"
        />
        <Text>Solo los productos granel pueden tener subproductos.</Text>
      </ScreenContent>
    );
  }

  return (
    <AddSubproductScreen
      businessCenterId={businessCenterId}
      businessCenters={
        businessCenters.length > 0
          ? businessCenters
          : [{ id: businessCenterId, name: businessCenterName ?? 'Sucursal principal' }]
      }
      categories={categories}
      isSaving={isSaving}
      onBack={goBack}
      onSave={async (values) => {
        setIsSaving(true);

        try {
          const subproductId = await persistSubproduct(values);
          router.replace(productDetailRoute(subproductId, 'manage-stock'));
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
          await persistSubproduct(values);
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
      parentProduct={product}
    />
  );
}
