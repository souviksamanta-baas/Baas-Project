import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Text } from 'react-native';

import { updateProductAssociatedCode } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
import { useInventoryProduct } from '../../../../../src/hooks/useInventoryProduct';
import { useProductCatalog } from '../../../../../src/context/ProductCatalogProvider';
import { parseInventoryReturnTo, productDetailRoute } from '../../../../../src/navigation/routes';
import { ProductCodeScreen } from '../../../../../src/screens/ProductCodeScreen';

export default function ProductCodeRoute(): ReactElement {
  const router = useRouter();
  const { productId: rawProductId, returnTo: rawReturnTo } = useLocalSearchParams<{
    productId: string;
    returnTo?: string | string[];
  }>();
  const returnTo = parseInventoryReturnTo(rawReturnTo);
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const { isLoading, product, productId } = useInventoryProduct(rawProductId);
  const catalog = useProductCatalog();
  const [isSaving, setIsSaving] = useState(false);

  if (!productId) {
    return (
      <ScreenContent>
        <InventoryScreenTitle onBack={() => router.back()} subtitle="Código" title="Producto" />
        <Text>Producto no encontrado.</Text>
      </ScreenContent>
    );
  }

  if (isLoading && !product) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={() => router.back()}
          subtitle="Código"
          title="Código del producto"
        />
        <Text>Cargando…</Text>
      </ScreenContent>
    );
  }

  if (!product || !organizationId) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={() => router.replace(productDetailRoute(productId, returnTo))}
          subtitle="Código"
          title="Código del producto"
        />
        <Text>Este producto no está disponible.</Text>
      </ScreenContent>
    );
  }

  return (
    <ProductCodeScreen
      isSaving={isSaving}
      onBack={() => router.back()}
      onSaveCode={async (input) => {
        setIsSaving(true);
        try {
          await updateProductAssociatedCode(organizationId, productId, input);
          await catalog.reloadProducts();
          router.replace(productDetailRoute(productId, returnTo ?? 'product-detail'));
        } finally {
          setIsSaving(false);
        }
      }}
      product={product}
    />
  );
}
