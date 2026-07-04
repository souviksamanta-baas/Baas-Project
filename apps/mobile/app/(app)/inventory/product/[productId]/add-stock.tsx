import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useInventoryProduct } from '../../../../../src/hooks/useInventoryProduct';
import { AddStockScreen } from '../../../../../src/screens/inventory/InventoryScreens';

export default function AddStockRoute(): ReactElement {
  const router = useRouter();
  const { productId: rawProductId } = useLocalSearchParams<{ productId: string }>();
  const { childProducts, isLoading, product } = useInventoryProduct(rawProductId);

  if (isLoading && !product) {
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
    <AddStockScreen onBack={() => router.back()} product={product} subproducts={childProducts} />
  );
}
