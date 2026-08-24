import type { Tone } from '../api/mockData';
import type { OwnerNotification, OwnerTask, OwnerTaskStatus } from '../types/tasks';

export type WorkQueueFilter =
  | 'all'
  | 'follow_up'
  | 'stock'
  | 'overdue'
  | 'pending'
  | 'in_progress'
  | 'postponed'
  | 'completed';

export type WorkQueueItemKind = 'task' | 'alert';

export interface WorkQueueItem {
  assigneeLabel: string | null;
  conversationId: string | null;
  dueAt: string | null;
  id: string;
  isFollowing: boolean;
  isUnread: boolean;
  kind: WorkQueueItemKind;
  notificationId: string | null;
  postponedUntil: string | null;
  productId: string | null;
  status: OwnerTaskStatus | OwnerNotification['status'];
  subtitle: string | null;
  taskId: string | null;
  timestamp: string;
  title: string;
  tone: Tone;
}

export function buildWorkQueue(
  tasks: OwnerTask[],
  notifications: OwnerNotification[],
): WorkQueueItem[] {
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
          item.status !== 'completed' &&
          item.status !== 'cancelled' &&
          item.status !== 'postponed',
      );
    case 'pending':
      return items.filter((item) => item.kind === 'task' && item.status === 'pending');
    case 'in_progress':
      return items.filter((item) => item.kind === 'task' && item.status === 'in_progress');
    case 'postponed':
      return items.filter((item) => item.kind === 'task' && item.status === 'postponed');
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
    assigneeLabel: task.assigneeLabel,
    conversationId: task.conversationId,
    dueAt: task.dueAt,
    id: `task:${task.id}`,
    isFollowing: task.isFollowing,
    isUnread: task.status === 'pending',
    kind: 'task',
    notificationId: null,
    postponedUntil: task.postponedUntil,
    productId: null,
    status: task.status,
    subtitle: buildTaskSubtitle(task),
    taskId: task.id,
    timestamp: task.dueAt ?? task.postponedUntil ?? new Date().toISOString(),
    title: compactTaskTitle(task.title),
    tone: taskTone(task.status),
  };
}

function buildTaskSubtitle(task: OwnerTask): string | null {
  const parts: string[] = [];
  if (task.assigneeLabel) {
    parts.push(task.assigneeLabel);
  }
  if (task.contactLabel && task.contactLabel !== task.assigneeLabel) {
    parts.push(task.contactLabel);
  } else if (!task.contactLabel && task.description) {
    parts.push(task.description);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

function taskTone(status: OwnerTaskStatus): Tone {
  if (status === 'postponed') return 'blue';
  if (status === 'in_progress') return 'purple';
  if (status === 'completed') return 'green';
  if (status === 'cancelled') return 'red';
  return 'orange';
}

/** Keep list titles short — important action/product only. */
export function compactTaskTitle(title: string): string {
  let next = title.trim().replace(/\s+/g, ' ');
  if (!next) {
    return title;
  }

  const parenMatch = next.match(/\(([^)]+)\)\s*$/);
  if (/^trabajar sobre\b/i.test(next) && parenMatch?.[1]) {
    next = compactProductLabel(parenMatch[1]);
  } else {
    next = next
      .replace(/^trabajar sobre\s+/i, '')
      .replace(/^presupuesto\s*[:·-]?\s*/i, '')
      .replace(/\bPRES-[A-Z0-9]+\b/gi, ' ')
      .replace(/\(\s*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    next = compactProductLabel(next);
  }

  if (!next) {
    next = title.trim();
  }

  if (next.length > 40) {
    return `${next.slice(0, 39).trimEnd()}…`;
  }

  return next;
}

function compactProductLabel(value: string): string {
  let next = value
    .replace(/\b(natural|crudo|cruda|granel|premium|extra|organico|orgánico)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = next.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    next = words.slice(0, 4).join(' ');
  }

  return next;
}

function toWorkQueueAlert(notification: OwnerNotification): WorkQueueItem {
  return {
    assigneeLabel: null,
    conversationId: null,
    dueAt: null,
    id: `alert:${notification.id}`,
    isFollowing: false,
    isUnread: notification.status === 'pending' || notification.status === 'sent',
    kind: 'alert',
    notificationId: notification.id,
    postponedUntil: null,
    productId: notification.productId,
    status: notification.status,
    subtitle: notification.productLabel ?? notification.body,
    taskId: null,
    timestamp: notification.createdAt,
    title: notification.title,
    tone: 'red',
  };
}
