import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { Text } from 'react-native';

import { ScreenContent } from '../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../src/components/inventoryUi';
import { useInventoryProduct } from '../../../../src/hooks/useInventoryProduct';
import { useProductLots } from '../../../../src/hooks/useProductLots';
import { useProductMovements } from '../../../../src/hooks/useProductMovements';
import { mapLotsToBatchRows } from '../../../../src/lib/inventoryLotsPresentation';
import { navigateInventoryReturn } from '../../../../src/navigation/inventoryNavigation';
import { parseInventoryReturnTo, routes } from '../../../../src/navigation/routes';
import { useInventoryNavigation } from '../../../../src/navigation/useInventoryNavigation';
import { ProductDetailScreen } from '../../../../src/screens/inventory/InventoryScreens';

export default function ProductDetailRoute(): ReactElement {
  const router = useRouter();
  const { productId: rawProductId, returnTo: rawReturnTo } = useLocalSearchParams<{
    productId: string;
    returnTo?: string | string[];
  }>();
  const returnTo = parseInventoryReturnTo(rawReturnTo);
  const { businessCenterName, childProducts, isLoading, parentProduct, product, productId } =
    useInventoryProduct(rawProductId);
  const { movements } = useProductMovements(productId);
  const { lots } = useProductLots(productId);
  const batchRows = useMemo(
    () => (product ? mapLotsToBatchRows(lots, product, childProducts) : []),
    [childProducts, lots, product],
  );

  const goBack = () => navigateInventoryReturn(router, { productId: productId ?? '', returnTo });

  if (!productId) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={() => router.back()}
          subtitle="Detalle y gestion del producto"
          title="Producto"
        />
        <Text>Producto no encontrado.</Text>
      </ScreenContent>
    );
  }

  const inventoryNav = useInventoryNavigation(productId, {
    isSubproduct: product?.parentProductId != null,
  });

  if (isLoading && !product) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Detalle y gestion del producto"
          title="Producto"
        />
        <Text>Cargando producto...</Text>
      </ScreenContent>
    );
  }

  if (!product) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={() => router.replace(routes.inventoryManageStock)}
          subtitle="Detalle y gestion del producto"
          title="Producto"
        />
        <Text>Este producto fue archivado o ya no esta disponible.</Text>
      </ScreenContent>
    );
  }

  return (
    <ProductDetailScreen
      {...inventoryNav}
      batchRows={batchRows}
      businessCenterName={businessCenterName}
      childProducts={childProducts}
      movements={movements}
      onBack={goBack}
      parentProduct={parentProduct}
      product={product}
    />
  );
}
