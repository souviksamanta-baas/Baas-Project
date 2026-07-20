import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';

import { useProductCatalog } from '../../../src/context/ProductCatalogProvider';
import { findProductByScannedCode } from '../../../src/lib/productCodes';
import {
  productDetailRoute,
  routes,
} from '../../../src/navigation/routes';
import { BarcodeScannerScreen } from '../../../src/screens/BarcodeScannerScreen';

export default function InventoryScanCodeRoute(): ReactElement {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const scanMode = (Array.isArray(mode) ? mode[0] : mode) === 'sell' ? 'sell' : 'manage-stock';
  const catalog = useProductCatalog();

  function handleScanned(value: string): void {
    const product = findProductByScannedCode(catalog.products, value);

    if (!product) {
      Alert.alert(
        'Sin coincidencias',
        `No encontramos un producto con el código «${value}».`,
        [{ onPress: () => router.back(), text: 'OK' }],
      );
      return;
    }

    if (scanMode === 'sell') {
      router.replace({
        pathname: routes.inventorySell,
        params: { scannedProductId: product.id, scannedCode: value },
      });
      return;
    }

    router.replace(productDetailRoute(product.id, 'manage-stock'));
  }

  return <BarcodeScannerScreen onBack={() => router.back()} onScanned={handleScanned} />;
}
