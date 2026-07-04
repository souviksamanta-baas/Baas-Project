import type { AppTab } from '../components/ui';

/** Default base product used by mock inventory screens. */
export const DEFAULT_BASE_PRODUCT_ID = 'p4';

export const routes = {
  appHome: '/(app)',
  appInbox: '/inbox',
  appCopi: '/copi',
  appCopiChat: '/copi/chat',
  appMore: '/more',
  authLogin: '/(auth)/login',
  authVerify: '/(auth)/verify',
  authOnboarding: '/(auth)/onboarding',
  account: '/(app)/account',
  notifications: '/(app)/notifications',
  inventoryManageStock: '/(app)/inventory/manage-stock',
  inventorySell: '/(app)/inventory/sell',
  inventoryConfirmPayment: '/(app)/inventory/confirm-payment',
  whatsappConnect: '/(app)/whatsapp-connect',
  staffInvite: '/(app)/staff-invite',
  staffInviteAccept: '/(auth)/invite-accept',
  editProfile: '/(app)/edit-profile',
} as const;

export function tabRoute(tab: AppTab): string {
  switch (tab) {
    case 'home':
      return routes.appHome;
    case 'inbox':
      return routes.appInbox;
    case 'copi':
      return routes.appCopi;
    case 'more':
      return routes.appMore;
  }
}

export function conversationRoute(conversationId: string): string {
  return `/inbox/${conversationId}`;
}

export function productDetailRoute(productId: string): string {
  return `/(app)/inventory/product/${productId}`;
}

export type InventoryReturnTo = 'manage-stock' | 'product-detail';

export function parseInventoryReturnTo(
  value: string | string[] | undefined,
): InventoryReturnTo | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === 'manage-stock' || raw === 'product-detail') {
    return raw;
  }

  return undefined;
}

export function resolveInventoryReturnRoute(
  returnTo: InventoryReturnTo | undefined,
  productId: string,
): string {
  if (returnTo === 'product-detail') {
    return productDetailRoute(productId);
  }

  return routes.inventoryManageStock;
}

export function productEditRoute(productId: string, returnTo?: InventoryReturnTo): string {
  const path = `/(app)/inventory/product/${productId}/edit`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function productAddStockRoute(productId: string): string {
  return `/(app)/inventory/product/${productId}/add-stock`;
}

export function productDeleteRoute(productId: string): string {
  return `/(app)/inventory/product/${productId}/delete`;
}

export type SubproductReturnTo = 'manage-stock' | 'product-detail' | 'product-edit';

export function parseSubproductReturnTo(
  value: string | string[] | undefined,
): SubproductReturnTo | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === 'manage-stock' || raw === 'product-detail' || raw === 'product-edit') {
    return raw;
  }

  return undefined;
}

export function resolveSubproductReturnRoute(
  returnTo: SubproductReturnTo | undefined,
  parentProductId: string,
): string {
  switch (returnTo) {
    case 'product-edit':
      return productEditRoute(parentProductId, 'product-detail');
    case 'manage-stock':
      return routes.inventoryManageStock;
    case 'product-detail':
    default:
      return productDetailRoute(parentProductId);
  }
}

export function subproductEditRoute(
  subproductId: string,
  returnTo?: SubproductReturnTo,
): string {
  const path = `/(app)/inventory/subproduct/${subproductId}/edit`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function getActiveTab(pathname: string): AppTab {
  const normalized = pathname.replace(/\/$/, '') || '/';

  if (normalized === '/(app)' || normalized === '/') {
    return 'home';
  }

  if (normalized === '/inbox' || normalized.startsWith('/inbox/')) {
    return 'inbox';
  }

  if (normalized === '/copi' || normalized.startsWith('/copi/')) {
    return 'copi';
  }

  if (normalized === '/more' || normalized.startsWith('/more/')) {
    return 'more';
  }

  return 'home';
}

export function shouldHideBottomNav(pathname: string): boolean {
  return (
    /\/inbox\/[^/]+$/.test(pathname) ||
    pathname.endsWith('/copi/chat') ||
    pathname.endsWith('/whatsapp-connect') ||
    pathname.endsWith('/staff-invite') ||
    pathname.endsWith('/edit-profile')
  );
}

export function shouldUseScrollShell(_pathname: string): boolean {
  return false;
}
