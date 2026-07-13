import {
  type InventoryReturnTo,
  type SubproductReturnTo,
  productDetailRoute,
  productEditRoute,
  resolveInventoryReturnRoute,
  resolveSubproductReturnRoute,
  routes,
} from './routes';

type InventoryRouter = {
  back: () => void;
  canGoBack?: () => boolean;
  replace: (href: string) => void;
};

export function navigateSubproductReturn(
  router: InventoryRouter,
  options: { parentProductId: string; returnTo?: SubproductReturnTo; preferBack?: boolean },
): void {
  if (options.returnTo === 'manage-stock') {
    router.replace(routes.inventoryManageStock);
    return;
  }

  if (options.returnTo === 'sell') {
    router.replace(routes.inventorySell);
    return;
  }

  if (options.returnTo === 'product-edit') {
    router.replace(productEditRoute(options.parentProductId, 'product-detail'));
    return;
  }

  if (options.preferBack !== false && router.canGoBack?.()) {
    router.back();
    return;
  }

  router.replace(resolveSubproductReturnRoute(options.returnTo, options.parentProductId));
}

export function navigateInventoryReturn(
  router: InventoryRouter,
  options: { productId: string; returnTo?: InventoryReturnTo; preferBack?: boolean },
): void {
  if (options.returnTo === 'manage-stock') {
    router.replace(routes.inventoryManageStock);
    return;
  }

  if (options.returnTo === 'sell') {
    router.replace(routes.inventorySell);
    return;
  }

  if (options.preferBack !== false && router.canGoBack?.()) {
    router.back();
    return;
  }

  if (options.returnTo === 'copi-chat') {
    router.replace(routes.appCopiChat);
    return;
  }

  router.replace(resolveInventoryReturnRoute(options.returnTo, options.productId));
}

export function navigateAfterProductArchive(
  router: InventoryRouter,
  options: { parentProductId?: string | null },
): void {
  if (options.parentProductId) {
    router.replace(productDetailRoute(options.parentProductId, 'manage-stock'));
    return;
  }

  router.replace(routes.inventoryManageStock);
}
