import { apiFetchAuthJson } from './client';

export type ReminderLeadMinutes = 15 | 30 | 60;

export type NotificationTypeId =
  | 'stock.low'
  | 'digest.daily'
  | 'digest.weekly'
  | 'task.assigned'
  | 'task.reminder'
  | 'task.overdue'
  | 'task.snooze_wake'
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

export interface NotificationPrefs {
  enabled: Partial<Record<NotificationTypeId, boolean>>;
  reminderLeadMinutes: ReminderLeadMinutes;
}

export async function getNotificationPrefs(organizationId: string): Promise<NotificationPrefs> {
  return apiFetchAuthJson<NotificationPrefs>(
    `/notifications/prefs?organizationId=${encodeURIComponent(organizationId)}`,
  );
}

export async function updateNotificationPrefs(params: {
  enabled?: Partial<Record<NotificationTypeId, boolean>>;
  organizationId: string;
  reminderLeadMinutes?: ReminderLeadMinutes;
}): Promise<NotificationPrefs> {
  return apiFetchAuthJson<NotificationPrefs>('/notifications/prefs', {
    body: JSON.stringify(params),
    method: 'PUT',
  });
}

export async function emitNotificationEvent(params: {
  body: string;
  businessCenterId: string;
  organizationId: string;
  payload?: Record<string, unknown>;
  sourceKey: string;
  title?: string;
  type: NotificationTypeId;
}): Promise<{ created: boolean; sent: number }> {
  return apiFetchAuthJson('/notifications/events', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}
