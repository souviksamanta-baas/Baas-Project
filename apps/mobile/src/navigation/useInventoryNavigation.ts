import { useRouter } from 'expo-router';

import {
  productAddStockRoute,
  productDeleteRoute,
  productDetailRoute,
  productEditRoute,
  routes,
  subproductEditRoute,
} from './routes';

export function useInventoryNavigation(productId: string) {
  const router = useRouter();

  return {
    onOpenAddStock: () => router.push(productAddStockRoute(productId)),
    onOpenConfirmPayment: () => router.push(routes.inventoryConfirmPayment),
    onOpenDeleteProduct: () => router.push(productDeleteRoute(productId)),
    onOpenEditProduct: () => router.push(productEditRoute(productId, 'product-detail')),
    onOpenEditSubproduct: (subproductId: string) =>
      router.push(subproductEditRoute(subproductId, 'product-detail')),
    onOpenProductDetail: (nextProductId: string = productId) => router.push(productDetailRoute(nextProductId)),
    onOpenSellProducts: () => router.push(routes.inventorySell),
  };
}

export function useSellNavigation() {
  const router = useRouter();

  return {
    onOpenConfirmPayment: () => router.push(routes.inventoryConfirmPayment),
  };
}

export type InventoryNavigation = ReturnType<typeof useInventoryNavigation>;
