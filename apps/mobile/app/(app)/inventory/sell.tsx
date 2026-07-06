import { useFocusEffect } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import { useSellCart } from '../../../src/context/SellCartProvider';
import { useProductCatalog } from '../../../src/context/ProductCatalogProvider';
import { mapProductsToSellRows } from '../../../src/lib/inventoryPresentation';
import { useSellNavigation } from '../../../src/navigation/useInventoryNavigation';
import { SellProductsScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function SellProductsRoute(): ReactElement {
  const catalog = useProductCatalog();
  const products = useMemo(() => mapProductsToSellRows(catalog.products), [catalog.products]);
  const sellNav = useSellNavigation(catalog.products);
  const sellCart = useSellCart();
  const { syncCartPrices } = sellCart;

  useFocusEffect(
    useCallback(() => {
      syncCartPrices(catalog.products);
    }, [catalog.products, syncCartPrices]),
  );

  function handleAddToCart(productId: string): void {
    const product = catalog.products.find((item) => item.id === productId);

    if (!product) {
      Alert.alert('Producto no encontrado', 'No se pudo agregar este producto al carrito.');
      return;
    }

    sellCart.addProduct(product);
  }

  function handleOpenConfirmPayment(): void {
    if (sellCart.cart.length === 0) {
      Alert.alert('Carrito vacio', 'Agrega productos antes de cobrar.');
      return;
    }

    sellNav.onOpenConfirmPayment();
  }

  return (
    <SellProductsScreen
      errorMessage={catalog.errorMessage}
      isLoading={catalog.isLoading}
      onAddToCart={handleAddToCart}
      onEditProduct={sellNav.onEditProduct}
      onOpenConfirmPayment={handleOpenConfirmPayment}
      onOpenProductDetail={sellNav.onOpenProductDetail}
      products={products}
    />
  );
}
