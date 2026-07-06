import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { updateProductDetails } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
import { useBusinessCenters } from '../../../../../src/hooks/useBusinessCenters';
import { useInventoryProduct } from '../../../../../src/hooks/useInventoryProduct';
import { collectCategoryOptions } from '../../../../../src/lib/productCatalog';
import { navigateAfterProductArchive, navigateInventoryReturn } from '../../../../../src/navigation/inventoryNavigation';
import {
  parseInventoryReturnTo,
  productAddSubproductRoute,
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
  const { productId: rawProductId, returnTo: rawReturnTo, mode: rawMode } = useLocalSearchParams<{
    mode?: string | string[];
    productId: string;
    returnTo?: string | string[];
  }>();
  const returnTo = parseInventoryReturnTo(rawReturnTo);
  const archiveMode = (Array.isArray(rawMode) ? rawMode[0] : rawMode) === 'archive';
  const routeProductId = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId;
  const { businessCenterName, childProducts, isLoading, product, productId, products, reloadProducts } =
    useInventoryProduct(rawProductId);
  const goBack = () =>
    navigateInventoryReturn(router, { productId: productId ?? routeProductId ?? '', returnTo });
  const businessCenters = useBusinessCenters();
  const [isSaving, setIsSaving] = useState(false);

  const categories = useMemo(
    () => collectCategoryOptions(products, product?.category),
    [product?.category, products],
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
      onOpenDeleteProduct={() => router.push(productDeleteRoute(productId, returnTo))}
      onOpenAddSubproduct={() => router.push(productAddSubproductRoute(productId, 'product-edit'))}
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
            archiveMode ? { ...values, status: 'archivado' } : values,
            product,
          );
          await reloadProducts();
          if (archiveMode) {
            navigateAfterProductArchive(router, {
              parentProductId: product.parentProductId,
            });
            return;
          }
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
      readOnly={archiveMode}
      subproducts={childProducts}
    />
  );
}
