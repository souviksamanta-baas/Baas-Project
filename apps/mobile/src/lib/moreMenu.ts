import type { IconKind } from '../components/icons';

export type MoreMenuRowId =
  | 'manage-stock'
  | 'add-product'
  | 'lots-movements'
  | 'compras'
  | 'manage-purchases'
  | 'load-purchase'
  | 'notifications-tasks'
  | 'billing'
  | 'cash'
  | 'account'
  | 'integrations'
  | 'suppliers'
  | 'help'
  | 'privacy';

export type MoreMenuSectionId = 'main' | 'connections' | 'support';

export type MoreMenuChildRow = {
  disabled?: boolean;
  icon: IconKind;
  id: MoreMenuRowId;
  subtitle: string;
  title: string;
};

export type MoreMenuRow = {
  children?: MoreMenuChildRow[];
  disabled?: boolean;
  icon: IconKind;
  id: MoreMenuRowId;
  subtitle: string;
  title: string;
};

export type MoreMenuSection = {
  feature: 'moreInventory' | 'moreOperations' | 'moreSettings';
  id: MoreMenuSectionId;
  rows: MoreMenuRow[];
};

/** Flat Más groups — no section titles. */
export const moreMenuSections: MoreMenuSection[] = [
  {
    feature: 'moreInventory',
    id: 'main',
    rows: [
      {
        icon: 'box',
        id: 'manage-stock',
        subtitle: 'Stock actual, alertas y catálogo',
        title: 'Gestionar stock',
      },
      {
        icon: 'plus',
        id: 'add-product',
        subtitle: 'Alta de productos y subproductos',
        title: 'Agregar producto',
      },
      {
        icon: 'document',
        id: 'lots-movements',
        subtitle: 'Ingresos, egresos y trazabilidad',
        title: 'Lotes y Movimientos',
      },
      {
        children: [
          {
            icon: 'document',
            id: 'manage-purchases',
            subtitle: 'Historial de remitos por fecha',
            title: 'Gestionar compras',
          },
          {
            icon: 'cart',
            id: 'load-purchase',
            subtitle: 'Remito, proveedor y carga de stock',
            title: 'Cargar compra',
          },
        ],
        icon: 'cart',
        id: 'compras',
        subtitle: 'Remitos, proveedores y carga de stock',
        title: 'Compras',
      },
      {
        icon: 'bell',
        id: 'notifications-tasks',
        subtitle: 'Alertas, seguimientos y pendientes',
        title: 'Notificaciones y Tareas',
      },
      {
        icon: 'bill',
        id: 'billing',
        subtitle: 'Presupuestos, estados y cobros',
        title: 'Facturación',
      },
      {
        disabled: true,
        icon: 'cash',
        id: 'cash',
        subtitle: 'Próximamente',
        title: 'Caja',
      },
    ],
  },
  {
    feature: 'moreSettings',
    id: 'connections',
    rows: [
      {
        icon: 'puzzle',
        id: 'integrations',
        subtitle: 'WhatsApp, Instagram, email y SMS',
        title: 'Integraciones',
      },
      {
        icon: 'users',
        id: 'suppliers',
        subtitle: 'Contactos de proveedores',
        title: 'Proveedores',
      },
    ],
  },
  {
    feature: 'moreSettings',
    id: 'support',
    rows: [
      {
        icon: 'shield',
        id: 'privacy',
        subtitle: 'Datos, permisos y eliminación de cuenta',
        title: 'Privacidad y datos',
      },
      {
        icon: 'help',
        id: 'help',
        subtitle: 'Ayuda personalizada por WhatsApp',
        title: 'Ayuda y soporte',
      },
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
