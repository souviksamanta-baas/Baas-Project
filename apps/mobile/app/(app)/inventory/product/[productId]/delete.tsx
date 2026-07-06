import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { deleteProduct } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
import { useInventoryProduct } from '../../../../../src/hooks/useInventoryProduct';
import { navigateAfterProductArchive, navigateInventoryReturn } from '../../../../../src/navigation/inventoryNavigation';
import {
  parseInventoryReturnTo,
  productEditRoute,
} from '../../../../../src/navigation/routes';
import { DeleteProductScreen } from '../../../../../src/screens/inventory/InventoryScreens';

export default function DeleteProductRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const { productId: rawProductId, returnTo: rawReturnTo } = useLocalSearchParams<{
    productId: string;
    returnTo?: string | string[];
  }>();
  const returnTo = parseInventoryReturnTo(rawReturnTo);
  const routeProductId = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId;
  const { childProducts, isLoading, product, productId, reloadProducts } =
    useInventoryProduct(rawProductId);
  const [isDeleting, setIsDeleting] = useState(false);

  const goBack = () =>
    navigateInventoryReturn(router, { productId: productId ?? routeProductId ?? '', returnTo });

  if (isLoading && !product) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Confirma si queres eliminar este producto"
          title="Eliminar producto"
        />
        <Text>Cargando producto...</Text>
      </ScreenContent>
    );
  }

  return (
    <DeleteProductScreen
      isDeleting={isDeleting}
      onBack={goBack}
      onDeactivate={() => {
        if (!productId) {
          return;
        }

        router.push(productEditRoute(productId, returnTo, { mode: 'archive' }));
      }}
      onDelete={async () => {
        if (!organizationId || !productId) {
          Alert.alert('No se pudo eliminar', 'Producto no encontrado.');
          return;
        }

        setIsDeleting(true);

        try {
          await deleteProduct(organizationId, productId);
          await reloadProducts();
          navigateAfterProductArchive(router, {
            parentProductId: product?.parentProductId,
          });
        } catch (error) {
          Alert.alert(
            'No se pudo eliminar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
        } finally {
          setIsDeleting(false);
        }
      }}
      product={product}
      subproducts={childProducts}
    />
  );
}
