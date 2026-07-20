import type { IconKind } from '../components/icons';

export type MoreMenuRowId =
  | 'manage-stock'
  | 'add-product'
  | 'lots-movements'
  | 'notifications-tasks'
  | 'billing'
  | 'cash'
  | 'reports-soon'
  | 'account'
  | 'integrations'
  | 'suppliers'
  | 'help';

export type MoreMenuSectionId = 'inventory' | 'operations' | 'reports' | 'settings';

export type MoreMenuRow = {
  disabled?: boolean;
  icon: IconKind;
  id: MoreMenuRowId;
  subtitle: string;
  title: string;
};

export type MoreMenuSection = {
  emptyMessage?: string;
  feature:
    | 'moreInventory'
    | 'moreOperations'
    | 'moreReports'
    | 'moreSettings';
  id: MoreMenuSectionId;
  rows: MoreMenuRow[];
  title: string;
};

export const moreMenuSections: MoreMenuSection[] = [
  {
    feature: 'moreInventory',
    id: 'inventory',
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
        icon: 'bell',
        id: 'notifications-tasks',
        subtitle: 'Alertas, seguimientos y pendientes',
        title: 'Notificaciones y Tareas',
      },
    ],
    title: 'Inventarios',
  },
  {
    feature: 'moreOperations',
    id: 'operations',
    rows: [
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
    title: 'Operaciones',
  },
  {
    emptyMessage: 'Reportes llegará pronto. Estamos armando los indicadores del negocio.',
    feature: 'moreReports',
    id: 'reports',
    rows: [],
    title: 'Reportes',
  },
  {
    feature: 'moreSettings',
    id: 'settings',
    rows: [
      {
        icon: 'user',
        id: 'account',
        subtitle: 'Perfil, negocio y equipo',
        title: 'Mi cuenta',
      },
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
      {
        icon: 'help',
        id: 'help',
        subtitle: 'Ayuda personalizada por WhatsApp',
        title: 'Ayuda y soporte',
      },
    ],
    title: 'Configuraciones',
  },
];
