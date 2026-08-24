import type { AppTab } from '../components/ui';

/** Default base product used by mock inventory screens. */
export const DEFAULT_BASE_PRODUCT_ID = 'p4';

export const routes = {
  appHome: '/(app)',
  appInbox: '/inbox',
  appCopi: '/copi',
  appCopiChat: '/copi/chat',
  appMore: '/more',
  authWelcome: '/(auth)/welcome',
  authLogin: '/(auth)/login',
  authVerify: '/(auth)/verify',
  authOnboarding: '/(auth)/onboarding',
  account: '/(app)/account',
  notifications: '/(app)/notifications',
  inventoryManageStock: '/(app)/inventory/manage-stock',
  inventoryLotsMovements: '/(app)/inventory/lots-movements',
  inventoryLoadPurchase: '/(app)/inventory/load-purchase',
  inventoryManagePurchases: '/(app)/inventory/manage-purchases',
  inventoryScanCode: '/(app)/inventory/scan-code',
  inventorySell: '/(app)/inventory/sell',
  inventoryConfirmPayment: '/(app)/inventory/confirm-payment',
  whatsappConnect: '/(app)/whatsapp-connect',
  staffInvite: '/(app)/staff-invite',
  staffInviteAccept: '/(auth)/invite-accept',
  editProfile: '/(app)/edit-profile',
  businessSettings: '/(app)/business-settings',
  arcaSettings: '/(app)/arca-settings',
  tasks: '/(app)/tasks',
  taskNew: '/(app)/tasks/new',
  appointments: '/(app)/appointments',
  billing: '/(app)/billing',
  presupuestos: '/(app)/billing',
  invoices: '/(app)/invoices',
  integrations: '/(app)/integrations',
  suppliers: '/(app)/suppliers',
  suppliersAdd: '/(app)/suppliers/add',
  helpSupport: '/(app)/help-support',
  privacyData: '/(app)/privacy-data',
  browserSessionScan: '/(app)/browser-session-scan',
  instagramConnect: '/(app)/instagram-connect',
  facebookConnect: '/(app)/facebook-connect',
} as const;

export type PresupuestoReturnTo =
  | 'sell'
  | 'billing'
  | 'copi-chat'
  | 'tasks-portal'
  | 'home'
  | 'more';

export function parsePresupuestoReturnTo(
  value: string | string[] | undefined,
): PresupuestoReturnTo | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (
    raw === 'sell' ||
    raw === 'billing' ||
    raw === 'copi-chat' ||
    raw === 'tasks-portal' ||
    raw === 'home' ||
    raw === 'more'
  ) {
    return raw;
  }

  return undefined;
}

export function resolvePresupuestoReturnRoute(
  returnTo: PresupuestoReturnTo | undefined,
): string {
  switch (returnTo) {
    case 'sell':
      return routes.inventorySell;
    case 'copi-chat':
      return routes.appCopiChat;
    case 'tasks-portal':
      return routes.tasks;
    case 'home':
      return routes.appHome;
    case 'more':
      return routes.appMore;
    case 'billing':
    default:
      return routes.billing;
  }
}

export function presupuestoDetailRoute(
  quoteId: string,
  returnTo?: PresupuestoReturnTo,
): string {
  const path = `/(app)/presupuestos/${encodeURIComponent(quoteId)}`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function invoiceDetailRoute(invoiceId: string): string {
  return `/(app)/invoices/${encodeURIComponent(invoiceId)}`;
}

export function manageStockRoute(options?: { lowStock?: boolean }): string {
  if (options?.lowStock) {
    return `${routes.inventoryManageStock}?filter=low_stock`;
  }

  return routes.inventoryManageStock;
}

export type WorkQueueFilter =
  | 'all'
  | 'follow_up'
  | 'stock'
  | 'overdue'
  | 'pending'
  | 'in_progress'
  | 'postponed'
  | 'completed';

export function tasksRoute(filter?: WorkQueueFilter): string {
  if (!filter || filter === 'all') {
    return routes.tasks;
  }

  return `${routes.tasks}?filter=${filter}`;
}

export function taskNewRoute(): string {
  return routes.taskNew;
}

export function taskDetailRoute(taskId: string, returnTo?: TaskReturnTo): string {
  const path = `/(app)/tasks/${taskId}`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function notificationDetailRoute(notificationId: string): string {
  return `/(app)/notifications/${encodeURIComponent(notificationId)}`;
}

export type AppointmentReturnTo = 'agenda' | 'home' | 'more';

export function appointmentDetailRoute(
  appointmentId: string,
  returnTo?: AppointmentReturnTo,
): string {
  const path = `/(app)/appointments/${encodeURIComponent(appointmentId)}`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function parseAppointmentReturnTo(
  value: string | string[] | undefined,
): AppointmentReturnTo | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === 'agenda' || raw === 'home' || raw === 'more') {
    return raw;
  }

  return undefined;
}

export function resolveAppointmentReturnRoute(
  returnTo: AppointmentReturnTo | undefined,
): string {
  if (returnTo === 'home') {
    return routes.appHome;
  }

  if (returnTo === 'more') {
    return routes.appMore;
  }

  return routes.appointments;
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
    raw === 'postponed' ||
    raw === 'completed' ||
    raw === 'pending' ||
    raw === 'in_progress'
  ) {
    return raw;
  }

  // Legacy alias — old links used ?filter=snoozed.
  if (raw === 'snoozed') {
    return 'postponed';
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

export function productCodeRoute(productId: string, returnTo?: InventoryReturnTo): string {
  const path = `/(app)/inventory/product/${productId}/code`;

  if (!returnTo) {
    return path;
  }

  return `${path}?returnTo=${returnTo}`;
}

export function inventoryScanRoute(options?: {
  mode?: 'manage-stock' | 'sell' | 'load-purchase';
}): string {
  if (!options?.mode) {
    return routes.inventoryScanCode;
  }

  return `${routes.inventoryScanCode}?mode=${options.mode}`;
}

export type InventoryReturnTo =
  | 'manage-stock'
  | 'load-purchase'
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
    raw === 'load-purchase' ||
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

  if (returnTo === 'load-purchase') {
    return routes.inventoryLoadPurchase;
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
    pathname.endsWith('/suppliers/add') ||
    pathname.endsWith('/edit-profile') ||
    pathname.endsWith('/business-settings') ||
    pathname.endsWith('/arca-settings') ||
    pathname.endsWith('/scan-code') ||
    pathname.endsWith('/browser-session-scan') ||
    /\/tasks\/[^/]+$/.test(pathname) ||
    /\/appointments\/[^/]+$/.test(pathname) ||
    /\/presupuestos\/[^/]+$/.test(pathname) ||
    /\/invoices\/[^/]+$/.test(pathname) ||
    /\/product\/[^/]+\/code$/.test(pathname)
  );
}

export function shouldUseScrollShell(_pathname: string): boolean {
  return false;
}
