import {
  type InventoryReturnTo,
  type SubproductReturnTo,
  productDetailRoute,
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
  options: { parentProductId: string; returnTo?: SubproductReturnTo },
): void {
  if (options.returnTo) {
    router.replace(resolveSubproductReturnRoute(options.returnTo, options.parentProductId));
    return;
  }

  if (router.canGoBack?.()) {
    router.back();
    return;
  }

  router.replace(productDetailRoute(options.parentProductId));
}

export function navigateInventoryReturn(
  router: InventoryRouter,
  options: { productId: string; returnTo?: InventoryReturnTo },
): void {
  if (options.returnTo) {
    router.replace(resolveInventoryReturnRoute(options.returnTo, options.productId));
    return;
  }

  if (router.canGoBack?.()) {
    router.back();
    return;
  }

  router.replace(routes.inventoryManageStock);
}
