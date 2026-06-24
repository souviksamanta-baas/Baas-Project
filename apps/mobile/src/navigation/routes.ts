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

export function productEditRoute(productId: string): string {
  return `/(app)/inventory/product/${productId}/edit`;
}

export function productAddStockRoute(productId: string): string {
  return `/(app)/inventory/product/${productId}/add-stock`;
}

export function productDeleteRoute(productId: string): string {
  return `/(app)/inventory/product/${productId}/delete`;
}

export function subproductEditRoute(subproductId: string): string {
  return `/(app)/inventory/subproduct/${subproductId}/edit`;
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
    pathname.endsWith('/whatsapp-connect')
  );
}

export function shouldUseScrollShell(_pathname: string): boolean {
  return false;
}
