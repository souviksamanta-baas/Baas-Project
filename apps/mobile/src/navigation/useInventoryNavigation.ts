import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import type { Product } from '../types/products';
import {
  productAddStockRoute,
  productAddSubproductRoute,
  productDeleteRoute,
  productDetailRoute,
  productEditRoute,
  routes,
  subproductEditRoute,
} from './routes';

export function useInventoryNavigation(
  productId: string,
  options?: { isSubproduct?: boolean },
) {
  const router = useRouter();
  const isSubproduct = options?.isSubproduct ?? false;

  return {
    onAddStock: () => router.push(productAddStockRoute(productId, 'product-detail')),
    onAddStockForProduct: (targetProductId: string) =>
      router.push(productAddStockRoute(targetProductId, 'product-detail')),
    onDeleteProductById: (targetProductId: string) =>
      router.push(productDeleteRoute(targetProductId, 'product-detail')),
    onOpenAddSubproduct: () => router.push(productAddSubproductRoute(productId, 'product-detail')),
    onOpenConfirmPayment: () => router.push(routes.inventoryConfirmPayment),
    onOpenDeleteProduct: () => router.push(productDeleteRoute(productId, 'product-detail')),
    onOpenEditProduct: () =>
      isSubproduct
        ? router.push(subproductEditRoute(productId, 'product-detail'))
        : router.push(productEditRoute(productId, 'product-detail')),
    onOpenEditSubproduct: (subproductId: string) =>
      router.push(subproductEditRoute(subproductId, 'product-detail')),
    onOpenProductDetail: (nextProductId: string = productId) =>
      router.push(productDetailRoute(nextProductId)),
    onOpenSellProducts: () => router.push(routes.inventorySell),
  };
}

export function useSellNavigation(products: Product[]) {
  const router = useRouter();
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  return {
    onEditProduct: (productId: string) => {
      const product = productsById.get(productId);

      if (product?.parentProductId != null) {
        router.push(subproductEditRoute(productId, 'sell'));
        return;
      }

      router.push(productEditRoute(productId, 'sell'));
    },
    onOpenConfirmPayment: () => router.push(routes.inventoryConfirmPayment),
    onOpenProductDetail: (productId: string) => router.push(productDetailRoute(productId, 'sell')),
  };
}

export type InventoryNavigation = ReturnType<typeof useInventoryNavigation>;
export type SellNavigation = ReturnType<typeof useSellNavigation>;
