import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';

import { useSellCart } from '../../../src/context/SellCartProvider';
import { useProductCatalog } from '../../../src/context/ProductCatalogProvider';
import { mapProductsToSellRows } from '../../../src/lib/inventoryPresentation';
import { inventoryScanRoute } from '../../../src/navigation/routes';
import { useSellNavigation } from '../../../src/navigation/useInventoryNavigation';
import { SellProductsScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function SellProductsRoute(): ReactElement {
  const router = useRouter();
  const { scannedCode, scannedProductId } = useLocalSearchParams<{
    scannedCode?: string | string[];
    scannedProductId?: string | string[];
  }>();
  const catalog = useProductCatalog();
  const products = useMemo(() => mapProductsToSellRows(catalog.products), [catalog.products]);
  const sellNav = useSellNavigation(catalog.products);
  const sellCart = useSellCart();
  const { syncCartPrices } = sellCart;
  const handledScanRef = useRef<string | null>(null);

  const initialSearchQuery = Array.isArray(scannedCode) ? scannedCode[0] : scannedCode;
  const scannedId = Array.isArray(scannedProductId) ? scannedProductId[0] : scannedProductId;

  useFocusEffect(
    useCallback(() => {
      syncCartPrices(catalog.products);
    }, [catalog.products, syncCartPrices]),
  );

  useEffect(() => {
    if (!scannedId || handledScanRef.current === scannedId) {
      return;
    }

    const product = catalog.products.find((item) => item.id === scannedId);
    handledScanRef.current = scannedId;

    if (!product) {
      return;
    }

    sellCart.addProduct(product);
    Alert.alert('Producto agregado', `${product.name} se sumó al carrito.`);
  }, [catalog.products, scannedId, sellCart]);

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
      initialSearchQuery={initialSearchQuery}
      isLoading={catalog.isLoading}
      onAddToCart={handleAddToCart}
      onEditProduct={sellNav.onEditProduct}
      onOpenConfirmPayment={handleOpenConfirmPayment}
      onOpenProductDetail={sellNav.onOpenProductDetail}
      onScanCode={() => router.push(inventoryScanRoute({ mode: 'sell' }))}
      products={products}
    />
  );
}
