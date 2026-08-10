import type { IconKind } from '../components/icons';

export type MoreMenuRowId =
  | 'ventas'
  | 'manage-stock'
  | 'add-product'
  | 'lots-movements'
  | 'compras'
  | 'manage-purchases'
  | 'load-purchase'
  | 'notifications-tasks'
  | 'billing'
  | 'invoices'
  | 'cash'
  | 'account'
  | 'integrations'
  | 'suppliers'
  | 'browser-session'
  | 'help'
  | 'privacy';

export type MoreMenuSectionId = 'inventory' | 'operations' | 'settings';

export type MoreMenuRow = {
  disabled?: boolean;
  icon: IconKind;
  id: MoreMenuRowId;
  title: string;
};

export type MoreMenuSection = {
  feature: 'moreInventory' | 'moreOperations' | 'moreSettings';
  id: MoreMenuSectionId;
  rows: MoreMenuRow[];
};

/** Flat Más groups — title only, no section headers or submenus. */
export const moreMenuSections: MoreMenuSection[] = [
  {
    feature: 'moreInventory',
    id: 'inventory',
    rows: [
      { icon: 'money', id: 'ventas', title: 'Ventas' },
      { icon: 'box', id: 'manage-stock', title: 'Gestionar stock' },
      { icon: 'cart', id: 'load-purchase', title: 'Cargar compras' },
      { icon: 'plus', id: 'add-product', title: 'Agregar producto' },
      { icon: 'document', id: 'lots-movements', title: 'Lotes y movimientos' },
    ],
  },
  {
    feature: 'moreOperations',
    id: 'operations',
    rows: [
      { icon: 'document', id: 'manage-purchases', title: 'Gestionar compras' },
      { icon: 'bill', id: 'billing', title: 'Presupuestos' },
      { icon: 'bill', id: 'invoices', title: 'Facturas' },
      { disabled: true, icon: 'cash', id: 'cash', title: 'Caja' },
    ],
  },
  {
    feature: 'moreSettings',
    id: 'settings',
    rows: [
      { icon: 'bell', id: 'notifications-tasks', title: 'Notificaciones y tareas' },
      { icon: 'users', id: 'suppliers', title: 'Proveedores' },
      { icon: 'puzzle', id: 'integrations', title: 'Integraciones' },
      { icon: 'qr', id: 'browser-session', title: 'Abrir sesión en el navegador' },
      { icon: 'shield', id: 'privacy', title: 'Privacidad y datos' },
      { icon: 'help', id: 'help', title: 'Ayuda y soporte' },
    ],
  },
];

export type AccountMenuActionId =
  | 'edit-profile'
  | 'staff-invite'
  | 'business-settings'
  | 'whatsapp'
  | 'sign-out';

export type AccountMenuRow = {
  danger?: boolean;
  disabled?: boolean;
  icon: IconKind;
  id: AccountMenuActionId;
  subtitle?: string;
  title: string;
};

/** Options under the expandable profile block on Más (Mi cuenta). */
export function buildAccountMenuRows(options: {
  canManageBusiness: boolean;
  timezoneLabel: string;
  whatsappSubtitle: string;
  whatsappTitle: string;
}): AccountMenuRow[] {
  const rows: AccountMenuRow[] = [
    { icon: 'users', id: 'staff-invite', title: 'Invitar miembro (QR)' },
    { icon: 'user', id: 'edit-profile', title: 'Editar perfil' },
  ];

  if (options.canManageBusiness) {
    rows.push({
      icon: 'gear',
      id: 'business-settings',
      title: 'Configuracion del negocio',
    });
  }

  rows.push(
    {
      icon: 'whatsapp',
      id: 'whatsapp',
      subtitle: options.whatsappSubtitle,
      title: options.whatsappTitle,
    },
    {
      disabled: !options.canManageBusiness,
      icon: 'globe',
      id: 'business-settings',
      subtitle: options.canManageBusiness ? 'Tocá para editar' : undefined,
      title: `Zona horaria: ${options.timezoneLabel}`,
    },
    { danger: true, icon: 'logout', id: 'sign-out', title: 'Cerrar sesion' },
  );

  return rows;
}
