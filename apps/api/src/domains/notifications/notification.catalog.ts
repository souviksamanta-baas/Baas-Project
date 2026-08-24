export type NotificationChannel = 'tareas' | 'inbox' | 'stock' | 'ventas' | 'pagos';

export type NotificationTypeId =
  | 'stock.low'
  | 'digest.daily'
  | 'digest.weekly'
  | 'task.assigned'
  | 'task.reminder'
  | 'task.overdue'
  | 'task.snooze_wake'
  | 'task.postpone_wake'
  | 'task.status_changed'
  | 'appointment.reminder'
  | 'appointment.assigned'
  | 'appointment.starting'
  | 'inbox.new_message'
  | 'inbox.unanswered'
  | 'sales.completed'
  | 'payment.received'
  | 'payment.failed'
  | 'stock.movement'
  | 'quote.accepted'
  | 'invoice.overdue'
  | 'copi.action_needed'
  | 'team.invite_accepted';

export type NotificationAudience =
  | 'admins'
  | 'assignee'
  | 'user'
  | 'creator_and_admins'
  | 'creator_and_followers';

export type ReminderLeadMinutes = 15 | 30 | 60;

export const DEFAULT_REMINDER_LEAD_MINUTES: ReminderLeadMinutes = 30;

export const REMINDER_LEAD_OPTIONS: ReminderLeadMinutes[] = [15, 30, 60];

export const ADMIN_ROLES = ['owner', 'manager', 'co_owner'] as const;

export interface NotificationCatalogEntry {
  audience: NotificationAudience;
  channel: NotificationChannel;
  defaultEnabled: boolean;
  id: NotificationTypeId;
  titleEs: string;
}

export const NOTIFICATION_CATALOG: Record<NotificationTypeId, NotificationCatalogEntry> = {
  'appointment.assigned': {
    audience: 'assignee',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'appointment.assigned',
    titleEs: 'Turno asignado',
  },
  'appointment.reminder': {
    audience: 'assignee',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'appointment.reminder',
    titleEs: 'Recordatorio de turno',
  },
  'appointment.starting': {
    audience: 'assignee',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'appointment.starting',
    titleEs: 'Turno por comenzar',
  },
  'copi.action_needed': {
    audience: 'user',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'copi.action_needed',
    titleEs: 'Copi necesita confirmación',
  },
  'digest.daily': {
    audience: 'admins',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'digest.daily',
    titleEs: 'Resumen diario',
  },
  'digest.weekly': {
    audience: 'admins',
    channel: 'tareas',
    defaultEnabled: false,
    id: 'digest.weekly',
    titleEs: 'Resumen semanal',
  },
  'inbox.new_message': {
    audience: 'admins',
    channel: 'inbox',
    defaultEnabled: true,
    id: 'inbox.new_message',
    titleEs: 'Nuevo mensaje de cliente',
  },
  'inbox.unanswered': {
    audience: 'admins',
    channel: 'inbox',
    defaultEnabled: true,
    id: 'inbox.unanswered',
    titleEs: 'Conversación sin responder',
  },
  'invoice.overdue': {
    audience: 'admins',
    channel: 'pagos',
    defaultEnabled: true,
    id: 'invoice.overdue',
    titleEs: 'Factura vencida',
  },
  'payment.failed': {
    audience: 'admins',
    channel: 'pagos',
    defaultEnabled: true,
    id: 'payment.failed',
    titleEs: 'Problema de pago',
  },
  'payment.received': {
    audience: 'admins',
    channel: 'pagos',
    defaultEnabled: false,
    id: 'payment.received',
    titleEs: 'Pago recibido',
  },
  'quote.accepted': {
    audience: 'creator_and_admins',
    channel: 'ventas',
    defaultEnabled: true,
    id: 'quote.accepted',
    titleEs: 'Presupuesto aceptado',
  },
  'sales.completed': {
    audience: 'admins',
    channel: 'ventas',
    defaultEnabled: false,
    id: 'sales.completed',
    titleEs: 'Venta registrada',
  },
  'stock.low': {
    audience: 'admins',
    channel: 'stock',
    defaultEnabled: true,
    id: 'stock.low',
    titleEs: 'Stock bajo',
  },
  'stock.movement': {
    audience: 'admins',
    channel: 'stock',
    defaultEnabled: false,
    id: 'stock.movement',
    titleEs: 'Movimiento de stock',
  },
  'task.assigned': {
    audience: 'assignee',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'task.assigned',
    titleEs: 'Tarea asignada',
  },
  'task.overdue': {
    audience: 'creator_and_followers',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'task.overdue',
    titleEs: 'Tarea vencida',
  },
  'task.postpone_wake': {
    audience: 'creator_and_followers',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'task.postpone_wake',
    titleEs: 'Tarea reactivada',
  },
  'task.reminder': {
    audience: 'creator_and_followers',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'task.reminder',
    titleEs: 'Recordatorio de tarea',
  },
  'task.snooze_wake': {
    audience: 'creator_and_followers',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'task.snooze_wake',
    titleEs: 'Tarea reactivada',
  },
  'task.status_changed': {
    audience: 'creator_and_followers',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'task.status_changed',
    titleEs: 'Cambio de estado de tarea',
  },
  'team.invite_accepted': {
    audience: 'admins',
    channel: 'tareas',
    defaultEnabled: true,
    id: 'team.invite_accepted',
    titleEs: 'Miembro se unió',
  },
};

export function isNotificationTypeEnabled(
  typeId: NotificationTypeId,
  enabledMap: Record<string, unknown> | null | undefined,
): boolean {
  const catalogDefault = NOTIFICATION_CATALOG[typeId].defaultEnabled;
  if (!enabledMap || typeof enabledMap !== 'object') {
    return catalogDefault;
  }
  const value = enabledMap[typeId];
  if (typeof value === 'boolean') {
    return value;
  }
  return catalogDefault;
}

export function normalizeReminderLeadMinutes(value: unknown): ReminderLeadMinutes {
  if (value === 15 || value === 30 || value === 60) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (parsed === 15 || parsed === 30 || parsed === 60) {
      return parsed;
    }
  }
  return DEFAULT_REMINDER_LEAD_MINUTES;
}
