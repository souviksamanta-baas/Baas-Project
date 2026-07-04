import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { listBusinessCenters } from '../../../../../src/api/dashboard';
import { updateProductDetails } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
import { useInventoryProduct } from '../../../../../src/hooks/useInventoryProduct';
import { useProducts } from '../../../../../src/hooks/useProducts';
import { collectCategoryOptions } from '../../../../../src/lib/productCatalog';
import { navigateInventoryReturn } from '../../../../../src/navigation/inventoryNavigation';
import {
  parseInventoryReturnTo,
  productDeleteRoute,
  productDetailRoute,
  subproductEditRoute,
} from '../../../../../src/navigation/routes';
import { EditProductScreen } from '../../../../../src/screens/inventory/InventoryScreens';

export default function EditProductRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const { productId: rawProductId, returnTo: rawReturnTo } = useLocalSearchParams<{
    productId: string;
    returnTo?: string | string[];
  }>();
  const returnTo = parseInventoryReturnTo(rawReturnTo);
  const routeProductId = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId;
  const { businessCenterName, childProducts, isLoading, product, productId } =
    useInventoryProduct(rawProductId);
  const goBack = () =>
    navigateInventoryReturn(router, { productId: productId ?? routeProductId ?? '', returnTo });
  const catalog = useProducts(organizationId, businessCenterId);
  const [businessCenters, setBusinessCenters] = useState<Array<{ id: string; name: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!organizationId) {
      setBusinessCenters([]);
      return;
    }

    listBusinessCenters(organizationId)
      .then(setBusinessCenters)
      .catch(() => {
        setBusinessCenters(
          businessCenterId && businessCenterName
            ? [{ id: businessCenterId, name: businessCenterName }]
            : [],
        );
      });
  }, [businessCenterId, businessCenterName, organizationId]);

  const categories = useMemo(
    () => collectCategoryOptions(catalog.products, product?.category),
    [catalog.products, product?.category],
  );

  if (!productId || !businessCenterId || !organizationId) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Actualiza la informacion del producto"
          title="Editar producto"
        />
        <Text>Producto no encontrado.</Text>
      </ScreenContent>
    );
  }

  if (isLoading && !product) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Actualiza la informacion del producto"
          title="Editar producto"
        />
        <Text>Cargando producto...</Text>
      </ScreenContent>
    );
  }

  if (!product) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Actualiza la informacion del producto"
          title="Editar producto"
        />
        <Text>Producto no encontrado.</Text>
      </ScreenContent>
    );
  }

  return (
    <EditProductScreen
      businessCenterId={businessCenterId}
      businessCenterName={businessCenterName}
      businessCenters={
        businessCenters.length > 0
          ? businessCenters
          : [{ id: businessCenterId, name: businessCenterName ?? 'Sucursal principal' }]
      }
      categories={categories}
      isSaving={isSaving}
      onBack={() => navigateInventoryReturn(router, { productId, returnTo })}
      onOpenDeleteProduct={() => router.push(productDeleteRoute(productId))}
      onOpenEditSubproduct={(subproductId) =>
        router.push(subproductEditRoute(subproductId, 'product-edit'))
      }
      onOpenSubproductDetail={(subproductId) => router.push(productDetailRoute(subproductId))}
      onSave={async (values) => {
        setIsSaving(true);

        try {
          await updateProductDetails(
            businessCenterId,
            organizationId,
            product.id,
            values,
            product,
          );
          navigateInventoryReturn(router, { productId, returnTo });
        } catch (error) {
          Alert.alert(
            'No se pudo guardar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
        } finally {
          setIsSaving(false);
        }
      }}
      product={product}
      subproducts={childProducts}
    />
  );
}
