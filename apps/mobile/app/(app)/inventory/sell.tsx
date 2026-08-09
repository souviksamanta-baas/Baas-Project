import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useSellCart } from '../../../src/context/SellCartProvider';
import { useProductCatalog } from '../../../src/context/ProductCatalogProvider';
import { mapProductsToSellRows } from '../../../src/lib/inventoryPresentation';
import { inventoryScanRoute, presupuestoDetailRoute } from '../../../src/navigation/routes';
import { useSellNavigation } from '../../../src/navigation/useInventoryNavigation';
import { SellProductsScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function SellProductsRoute(): ReactElement {
  const router = useRouter();
  const { scannedCode } = useLocalSearchParams<{
    scannedCode?: string | string[];
  }>();
  const catalog = useProductCatalog();
  const products = useMemo(() => mapProductsToSellRows(catalog.products), [catalog.products]);
  const sellNav = useSellNavigation(catalog.products);
  const sellCart = useSellCart();
  const { syncCartPrices } = sellCart;
  const [isOpeningCobro, setIsOpeningCobro] = useState(false);

  const initialSearchQuery = Array.isArray(scannedCode) ? scannedCode[0] : scannedCode;

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

  async function handleOpenConfirmPayment(): Promise<void> {
    if (sellCart.cart.length === 0) {
      Alert.alert('Carrito vacio', 'Agrega productos antes de cobrar.');
      return;
    }

    if (isOpeningCobro) {
      return;
    }

    setIsOpeningCobro(true);
    try {
      const quoteId = await sellCart.saveQuote();
      router.push(presupuestoDetailRoute(quoteId, 'sell'));
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsOpeningCobro(false);
    }
  }

  return (
    <SellProductsScreen
      errorMessage={catalog.errorMessage}
      initialSearchQuery={initialSearchQuery}
      isLoading={catalog.isLoading}
      onAddToCart={handleAddToCart}
      onEditProduct={sellNav.onEditProduct}
      onOpenConfirmPayment={() => void handleOpenConfirmPayment()}
      onOpenProductDetail={sellNav.onOpenProductDetail}
      onScanCode={() => router.push(inventoryScanRoute({ mode: 'sell' }))}
      products={products}
    />
  );
}
