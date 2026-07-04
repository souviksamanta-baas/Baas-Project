import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { ScreenContent } from '../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../src/components/inventoryUi';
import { useInventoryProduct } from '../../../../src/hooks/useInventoryProduct';
import { useProductMovements } from '../../../../src/hooks/useProductMovements';
import { useInventoryNavigation } from '../../../../src/navigation/useInventoryNavigation';
import { ProductDetailScreen } from '../../../../src/screens/inventory/InventoryScreens';

export default function ProductDetailRoute(): ReactElement {
  const router = useRouter();
  const { productId: rawProductId } = useLocalSearchParams<{ productId: string }>();
  const { businessCenterName, childProducts, isLoading, product, productId } =
    useInventoryProduct(rawProductId);
  const { movements } = useProductMovements(productId);

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

  const inventoryNav = useInventoryNavigation(productId);

  if (isLoading && !product) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={() => router.back()}
          subtitle="Detalle y gestion del producto"
          title="Producto"
        />
        <Text>Cargando producto...</Text>
      </ScreenContent>
    );
  }

  return (
    <ProductDetailScreen
      {...inventoryNav}
      businessCenterName={businessCenterName}
      childProducts={childProducts}
      movements={movements}
      onBack={() => router.back()}
      product={product}
    />
  );
}
