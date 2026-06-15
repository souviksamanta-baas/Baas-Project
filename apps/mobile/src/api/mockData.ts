export type Channel = 'email' | 'facebook' | 'instagram' | 'whatsapp';
export type Tone = 'blue' | 'green' | 'orange' | 'purple' | 'red';

export interface OwnerProfileMock {
  activeBranch: string;
  businessName: string;
  name: string;
  role: string;
}

export interface DashboardMetricMock {
  id: string;
  label: string;
  tone: Tone;
  value: string;
}

export interface ConversationMessageMock {
  direction: 'inbound' | 'outbound';
  id: string;
  source?: Channel | 'copi' | 'owner';
  text: string;
  time: string;
}

export interface ConversationMock {
  avatar: string;
  channel: Channel;
  customerName: string;
  id: string;
  messages: ConversationMessageMock[];
  preview: string;
  statusLabel?: string;
  time: string;
  unreadCount?: number;
}

export interface NotificationMock {
  id: string;
  subtitle?: string;
  time: string;
  title: string;
  tone: Tone;
  unread?: boolean;
}

export interface MenuSectionMock {
  id: string;
  rows: Array<{
    icon: string;
    id: string;
    subtitle?: string;
    title: string;
  }>;
  title: string;
}

export const ownerProfile: OwnerProfileMock = {
  activeBranch: 'Sucursal Centro',
  businessName: 'Almacen Juli',
  name: 'Juli Fernandez',
  role: 'Propietaria / Administradora',
};

export const branches = ['Sucursal Centro', 'Sucursal Palermo', 'Deposito / Taller'];

export const dashboardMetrics: DashboardMetricMock[] = [
  { id: 'messages', label: 'Mensajes hoy', tone: 'green', value: '32' },
  { id: 'tasks', label: 'Seguimientos pendientes', tone: 'orange', value: '7' },
  { id: 'stock', label: 'Productos con bajo stock', tone: 'red', value: '3' },
  { id: 'sales', label: 'Ventas (Semana)', tone: 'green', value: '$1.250' },
];

export const conversations: ConversationMock[] = [
  {
    avatar: 'MG',
    channel: 'whatsapp',
    customerName: 'Maria Gonzalez',
    id: 'maria',
    messages: [
      { direction: 'inbound', id: 'm1', source: 'whatsapp', text: 'Hola, tienen disponible el producto Amanda 1kg?', time: '11:32' },
      { direction: 'outbound', id: 'm2', source: 'owner', text: 'Hola Maria! Si, tenemos stock disponible.', time: '11:33' },
      { direction: 'inbound', id: 'm3', source: 'whatsapp', text: 'Perfecto, cuanto cuesta y hacen envios?', time: '11:34' },
      { direction: 'outbound', id: 'm4', source: 'owner', text: 'Sale $4.800 y hacemos envios a domicilio.', time: '11:35' },
    ],
    preview: 'Hola, tienen disponible el producto...?',
    statusLabel: 'Nuevo lead',
    time: '11:32',
    unreadCount: 2,
  },
  {
    avatar: 'TB',
    channel: 'instagram',
    customerName: '@tiendabaaS',
    id: 'tienda',
    messages: [],
    preview: 'Hacen envios a domicilio?',
    time: '10:48',
    unreadCount: 1,
  },
  {
    avatar: 'CR',
    channel: 'facebook',
    customerName: 'Carlos Ramirez',
    id: 'carlos',
    messages: [],
    preview: 'Perfecto, enviame la cotizacion',
    statusLabel: 'Seguimiento',
    time: '09:15',
  },
  {
    avatar: 'LM',
    channel: 'email',
    customerName: 'Laura Martinez',
    id: 'laura',
    messages: [],
    preview: 'Me pueden enviar la factura?',
    statusLabel: 'Cliente',
    time: 'Ayer',
  },
];

export const copiMessages: ConversationMessageMock[] = [
  { direction: 'outbound', id: 'c1', source: 'owner', text: 'Que necesita mi atencion hoy?', time: '09:41' },
  {
    direction: 'inbound',
    id: 'c2',
    source: 'copi',
    text: 'Hoy tenes 12 conversaciones abiertas, 3 productos con bajo stock y 4 seguimientos pendientes.',
    time: '09:41',
  },
  { direction: 'outbound', id: 'c3', source: 'owner', text: 'Cuales son los productos con bajo stock?', time: '09:42' },
  {
    direction: 'inbound',
    id: 'c4',
    source: 'copi',
    text: 'Yerba Amanda 1kg, Leche Entera 1L y Azucar 500g estan por debajo del minimo.',
    time: '09:42',
  },
];

export const suggestedQuestions = [
  'Que necesita mi atencion hoy?',
  'Cuanto vendi este mes?',
  'Quien me debe dinero?',
  'Que productos tienen bajo stock?',
  'Que producto tiene mayor margen?',
];

export const notifications: NotificationMock[] = [
  {
    id: 'stock',
    subtitle: 'Camiseta Basica tiene 2 unidades.',
    time: 'Hoy',
    title: 'Producto con bajo stock',
    tone: 'red',
    unread: true,
  },
  {
    id: 'followups',
    subtitle: 'Revisa clientes que esperan respuesta.',
    time: 'Hoy',
    title: '7 seguimientos pendientes',
    tone: 'orange',
  },
  {
    id: 'copi',
    subtitle: 'Mensajes sin responder, bajo stock y seguimientos.',
    time: 'Hoy',
    title: 'Copi detecto 3 tareas prioritarias',
    tone: 'purple',
  },
];

export const menuSections: MenuSectionMock[] = [
  {
    id: 'operations',
    rows: [
      { icon: 'box', id: 'inventory', subtitle: 'Stock, productos y movimientos', title: 'Inventario' },
      { icon: 'bill', id: 'billing', subtitle: 'Comprobantes y cobros', title: 'Facturacion' },
      { icon: 'cart', id: 'purchases', subtitle: 'Ordenes y abastecimiento', title: 'Compras y proveedores' },
      { icon: 'cash', id: 'cash', subtitle: 'Ingresos, egresos y cierre', title: 'Caja' },
    ],
    title: 'Operacion',
  },
  {
    id: 'growth',
    rows: [
      { icon: 'megaphone', id: 'marketing', subtitle: 'Promociones, campanas y posteos', title: 'Marketing' },
      { icon: 'users', id: 'portal', subtitle: 'Catalogo, reservas y seguimiento', title: 'Portal del cliente' },
      { icon: 'bot', id: 'automation', subtitle: 'Mensajes, reglas y acciones', title: 'Automatizaciones' },
    ],
    title: 'Crecimiento',
  },
  {
    id: 'settings',
    rows: [
      { icon: 'user', id: 'account', subtitle: 'Perfil, rol y sucursal', title: 'Mi cuenta' },
      { icon: 'puzzle', id: 'integrations', subtitle: 'WhatsApp, Instagram y Email', title: 'Integraciones' },
      { icon: 'help', id: 'help', subtitle: 'Guias y asistencia', title: 'Ayuda y soporte' },
    ],
    title: 'Configuracion',
  },
];
