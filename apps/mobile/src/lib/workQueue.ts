import type { Tone } from '../api/mockData';
import type { OwnerNotification, OwnerTask, OwnerTaskStatus } from '../types/tasks';

export type WorkQueueFilter = 'all' | 'follow_up' | 'stock' | 'overdue' | 'snoozed' | 'completed';

export type WorkQueueItemKind = 'task' | 'alert';

export interface WorkQueueItem {
  conversationId: string | null;
  dueAt: string | null;
  id: string;
  isUnread: boolean;
  kind: WorkQueueItemKind;
  notificationId: string | null;
  productId: string | null;
  status: OwnerTaskStatus | OwnerNotification['status'];
  subtitle: string | null;
  taskId: string | null;
  timestamp: string;
  title: string;
  tone: Tone;
}

export function buildWorkQueue(tasks: OwnerTask[], notifications: OwnerNotification[]): WorkQueueItem[] {
  const taskItems = tasks.map(toWorkQueueTask);
  const alertItems = notifications.map(toWorkQueueAlert);
  return [...taskItems, ...alertItems].sort(compareWorkQueueItems);
}

export function filterWorkQueue(items: WorkQueueItem[], filter: WorkQueueFilter): WorkQueueItem[] {
  const now = Date.now();

  switch (filter) {
    case 'follow_up':
      return items.filter((item) => item.kind === 'task');
    case 'stock':
      return items.filter((item) => item.kind === 'alert');
    case 'overdue':
      return items.filter(
        (item) =>
          item.kind === 'task' &&
          item.dueAt != null &&
          new Date(item.dueAt).getTime() < now &&
          item.status !== 'completed',
      );
    case 'snoozed':
      return items.filter((item) => item.kind === 'task' && item.status === 'snoozed');
    case 'completed':
      return items.filter((item) => item.kind === 'task' && item.status === 'completed');
    case 'all':
    default:
      return items;
  }
}

export function formatWorkQueueTime(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function compareWorkQueueItems(left: WorkQueueItem, right: WorkQueueItem): number {
  const leftTime = new Date(left.dueAt ?? left.timestamp).getTime();
  const rightTime = new Date(right.dueAt ?? right.timestamp).getTime();
  return leftTime - rightTime;
}

function toWorkQueueTask(task: OwnerTask): WorkQueueItem {
  return {
    conversationId: task.conversationId,
    dueAt: task.dueAt,
    id: `task:${task.id}`,
    isUnread: task.status === 'pending',
    kind: 'task',
    notificationId: null,
    productId: null,
    status: task.status,
    subtitle: task.contactLabel ?? task.description,
    taskId: task.id,
    timestamp: task.dueAt ?? task.snoozedUntil ?? new Date().toISOString(),
    title: task.title,
    tone: task.status === 'snoozed' ? 'blue' : 'orange',
  };
}

function toWorkQueueAlert(notification: OwnerNotification): WorkQueueItem {
  return {
    conversationId: null,
    dueAt: null,
    id: `alert:${notification.id}`,
    isUnread: notification.status === 'pending' || notification.status === 'sent',
    kind: 'alert',
    notificationId: notification.id,
    productId: notification.productId,
    status: notification.status,
    subtitle: notification.productLabel ?? notification.body,
    taskId: null,
    timestamp: notification.createdAt,
    title: notification.title,
    tone: 'red',
  };
}
