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
  tasks: '/(app)/tasks',
} as const;

export type WorkQueueFilter = 'all' | 'follow_up' | 'stock' | 'overdue' | 'snoozed' | 'completed';

export function tasksRoute(filter?: WorkQueueFilter): string {
  if (!filter || filter === 'all') {
    return routes.tasks;
  }

  return `${routes.tasks}?filter=${filter}`;
}

export function taskDetailRoute(taskId: string, returnTo?: TaskReturnTo): string {
  const path = `/(app)/tasks/${taskId}`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export type TaskReturnTo = 'tasks-portal' | 'notifications' | 'home';

export function parseTaskReturnTo(value: string | string[] | undefined): TaskReturnTo | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === 'tasks-portal' || raw === 'notifications' || raw === 'home') {
    return raw;
  }

  return undefined;
}

export function resolveTaskReturnRoute(returnTo: TaskReturnTo | undefined): string {
  if (returnTo === 'notifications') {
    return routes.notifications;
  }

  if (returnTo === 'home') {
    return routes.appHome;
  }

  return routes.tasks;
}

export function parseWorkQueueFilter(value: string | string[] | undefined): WorkQueueFilter {
  const raw = Array.isArray(value) ? value[0] : value;

  if (
    raw === 'follow_up' ||
    raw === 'stock' ||
    raw === 'overdue' ||
    raw === 'snoozed' ||
    raw === 'completed'
  ) {
    return raw;
  }

  return 'all';
}

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

export function productDetailRoute(
  productId: string,
  returnTo?: InventoryReturnTo,
): string {
  const path = `/(app)/inventory/product/${productId}`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export type InventoryReturnTo =
  | 'manage-stock'
  | 'product-detail'
  | 'sell'
  | 'copi-chat'
  | 'tasks-portal'
  | 'notifications'
  | 'home';

export function parseInventoryReturnTo(
  value: string | string[] | undefined,
): InventoryReturnTo | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (
    raw === 'manage-stock' ||
    raw === 'product-detail' ||
    raw === 'sell' ||
    raw === 'copi-chat' ||
    raw === 'tasks-portal' ||
    raw === 'notifications' ||
    raw === 'home'
  ) {
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

  if (returnTo === 'sell') {
    return routes.inventorySell;
  }

  if (returnTo === 'copi-chat') {
    return routes.appCopiChat;
  }

  if (returnTo === 'tasks-portal') {
    return routes.tasks;
  }

  if (returnTo === 'notifications') {
    return routes.notifications;
  }

  if (returnTo === 'home') {
    return routes.appHome;
  }

  return routes.inventoryManageStock;
}

export function productAddSubproductRoute(
  parentProductId: string,
  returnTo?: InventoryReturnTo | 'product-edit',
): string {
  const path = `/(app)/inventory/product/${parentProductId}/add-subproduct`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function productAddRoute(returnTo?: InventoryReturnTo): string {
  const path = '/(app)/inventory/add-product';

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function productEditRoute(
  productId: string,
  returnTo?: InventoryReturnTo,
  options?: { mode?: 'archive' },
): string {
  const params = new URLSearchParams();

  if (returnTo) {
    params.set('returnTo', returnTo);
  }

  if (options?.mode) {
    params.set('mode', options.mode);
  }

  const query = params.toString();
  const path = `/(app)/inventory/product/${productId}/edit`;

  return query.length > 0 ? `${path}?${query}` : path;
}

export function productAddStockRoute(productId: string, returnTo?: InventoryReturnTo): string {
  const path = `/(app)/inventory/product/${productId}/add-stock`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function productDeleteRoute(productId: string, returnTo?: InventoryReturnTo): string {
  const path = `/(app)/inventory/product/${productId}/delete`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export type SubproductReturnTo = 'manage-stock' | 'product-detail' | 'product-edit' | 'sell';

export function parseSubproductReturnTo(
  value: string | string[] | undefined,
): SubproductReturnTo | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (
    raw === 'manage-stock' ||
    raw === 'product-detail' ||
    raw === 'product-edit' ||
    raw === 'sell'
  ) {
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
    case 'sell':
      return routes.inventorySell;
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
    pathname.endsWith('/edit-profile') ||
    /\/tasks\/[^/]+$/.test(pathname)
  );
}

export function shouldUseScrollShell(_pathname: string): boolean {
  return false;
}
