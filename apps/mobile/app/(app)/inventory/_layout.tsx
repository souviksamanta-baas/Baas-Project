import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

import { ProductCatalogProvider } from '../../../src/context/ProductCatalogProvider';
import { SellCartProvider } from '../../../src/context/SellCartProvider';

export default function InventoryLayout(): ReactElement {
  return (
    <ProductCatalogProvider>
      <SellCartProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SellCartProvider>
    </ProductCatalogProvider>
  );
}
