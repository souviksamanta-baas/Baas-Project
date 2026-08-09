import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';

import { useProductCatalog } from '../../../src/context/ProductCatalogProvider';
import { findProductByScannedCode } from '../../../src/lib/productCodes';
import {
  productAddStockRoute,
  productDetailRoute,
  routes,
} from '../../../src/navigation/routes';
import { BarcodeScannerScreen } from '../../../src/screens/BarcodeScannerScreen';

type ScanMode = 'manage-stock' | 'sell' | 'load-purchase';

function parseScanMode(value: string | string[] | undefined): ScanMode {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'sell' || raw === 'load-purchase' || raw === 'manage-stock') {
    return raw;
  }
  return 'manage-stock';
}

export default function InventoryScanCodeRoute(): ReactElement {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const scanMode = parseScanMode(mode);
  const catalog = useProductCatalog();

  function handleScanned(payload: {
    unlock: () => void;
    value: string;
  }): void {
    const product = findProductByScannedCode(catalog.products, payload.value);

    if (!product) {
      Alert.alert(
        'Sin coincidencias',
        `No encontramos un producto con el código «${payload.value}».\n\nPodés asociarlo desde el producto → Gestionar código.`,
        [
          { onPress: payload.unlock, text: 'Reintentar' },
          { onPress: () => router.back(), style: 'cancel', text: 'Cerrar' },
        ],
      );
      return;
    }

    if (scanMode === 'sell') {
      // Only prefill search — never auto-add to cart. User taps + on the result.
      router.replace({
        pathname: routes.inventorySell,
        params: { scannedCode: payload.value },
      });
      return;
    }

    if (scanMode === 'load-purchase') {
      router.replace(productAddStockRoute(product.id, 'load-purchase'));
      return;
    }

    router.replace(productDetailRoute(product.id, 'manage-stock'));
  }

  return (
    <BarcodeScannerScreen
      hint={
        scanMode === 'sell'
          ? 'Escaneá para buscar el producto en Ventas'
          : scanMode === 'load-purchase'
            ? 'Escaneá para cargar stock de compra'
            : 'Escaneá para abrir el producto'
      }
      onBack={() => router.back()}
      onScanned={handleScanned}
    />
  );
}
