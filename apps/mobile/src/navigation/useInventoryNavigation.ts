import { useRouter } from 'expo-router';

import {
  DEFAULT_BASE_PRODUCT_ID,
  productAddStockRoute,
  productDeleteRoute,
  productDetailRoute,
  productEditRoute,
  routes,
  subproductEditRoute,
} from './routes';

export function useInventoryNavigation(productId: string = DEFAULT_BASE_PRODUCT_ID) {
  const router = useRouter();

  return {
    onOpenAddStock: () => router.push(productAddStockRoute(productId)),
    onOpenConfirmPayment: () => router.push(routes.inventoryConfirmPayment),
    onOpenDeleteProduct: () => router.push(productDeleteRoute(productId)),
    onOpenEditProduct: () => router.push(productEditRoute(productId)),
    onOpenEditSubproduct: (subproductId: string) => router.push(subproductEditRoute(subproductId)),
    onOpenProductDetail: (nextProductId: string = productId) => router.push(productDetailRoute(nextProductId)),
    onOpenSellProducts: () => router.push(routes.inventorySell),
  };
}

export type InventoryNavigation = ReturnType<typeof useInventoryNavigation>;
