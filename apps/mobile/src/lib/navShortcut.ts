import type { IconKind } from '../components/icons';
import { moreMenuSections, type MoreMenuRowId } from './moreMenu';
import { productAddRoute, routes } from '../navigation/routes';

/** Built-in default shortcut: Ventas ($). Also listed on Más. */
export type NavShortcutId = Exclude<MoreMenuRowId, 'compras' | 'account'>;

export type NavShortcutOption = {
  disabled?: boolean;
  icon: IconKind;
  id: NavShortcutId;
  /** Short label for the bottom tab. */
  label: string;
  title: string;
};

const VENTAS_OPTION: NavShortcutOption = {
  icon: 'money',
  id: 'ventas',
  label: 'Vender',
  title: 'Vender',
};

/** Options for the custom bottom-nav shortcut (all Más items; Ventas first as default). */
export function listNavShortcutOptions(): NavShortcutOption[] {
  const fromMore: NavShortcutOption[] = moreMenuSections.flatMap((section) =>
    section.rows
      .filter((row) => row.id !== 'compras' && row.id !== 'account' && row.id !== 'ventas')
      .map((row) => ({
        disabled: row.disabled,
        icon: row.icon,
        id: row.id as NavShortcutId,
        label: shortNavLabel(row.title),
        title: row.title,
      })),
  );

  return [VENTAS_OPTION, ...fromMore];
}

export function getNavShortcutOption(id: string | null | undefined): NavShortcutOption {
  const options = listNavShortcutOptions();
  const match = options.find((option) => option.id === id && !option.disabled);
  return match ?? VENTAS_OPTION;
}

export function normalizeNavShortcutId(value: string | null | undefined): NavShortcutId {
  return getNavShortcutOption(value).id;
}

function shortNavLabel(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= 10) {
    return trimmed;
  }

  // Prefer first meaningful word for long Más titles.
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.length <= 10 ? first : `${first.slice(0, 9)}…`;
}

/** Resolve Expo route for a shortcut. Returns null if disabled / unknown. */
export function resolveNavShortcutRoute(id: NavShortcutId): string | null {
  switch (id) {
    case 'ventas':
      return routes.inventorySell;
    case 'manage-stock':
      return routes.inventoryManageStock;
    case 'add-product':
      return productAddRoute('manage-stock');
    case 'lots-movements':
      return routes.inventoryLotsMovements;
    case 'manage-purchases':
      return routes.inventoryManagePurchases;
    case 'load-purchase':
      return routes.inventoryLoadPurchase;
    case 'notifications-tasks':
      return routes.tasks;
    case 'billing':
      return routes.billing;
    case 'integrations':
      return routes.integrations;
    case 'suppliers':
      return routes.suppliers;
    case 'help':
      return routes.helpSupport;
    case 'privacy':
      return routes.privacyData;
    case 'browser-session':
      return routes.browserSessionScan;
    case 'cash':
      return null;
    default:
      return null;
  }
}

/** Whether the current pathname should highlight the custom shortcut tab. */
export function isNavShortcutActive(pathname: string, id: NavShortcutId): boolean {
  const route = resolveNavShortcutRoute(id);
  if (!route) {
    return false;
  }

  const normalized = stripAppPath(pathname);
  const target = stripAppPath(route);

  if (id === 'ventas') {
    return normalized.includes('/inventory/sell') || normalized.includes('/inventory/confirm-payment');
  }

  if (id === 'billing') {
    return normalized.includes('/billing') || normalized.includes('/presupuestos/');
  }

  if (id === 'add-product') {
    return (
      normalized === '/inventory/add-product' ||
      normalized.startsWith('/inventory/add-product/') ||
      /\/inventory\/product\/[^/]+\/add-subproduct$/.test(normalized)
    );
  }

  if (id === 'manage-stock') {
    return (
      normalized === '/inventory/manage-stock' ||
      normalized.startsWith('/inventory/manage-stock/') ||
      normalized.startsWith('/inventory/product/')
    );
  }

  return normalized === target || normalized.startsWith(`${target}/`);
}

function stripAppPath(path: string): string {
  return (
    path
      .split('?')[0]
      ?.replace(/^\/\(app\)/, '')
      .replace(/\/$/, '') || '/'
  );
}
