export type OwnerTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'postponed';

export type OwnerTaskType = 'follow_up' | 'manual' | 'copi' | 'inventory' | 'callback';

export interface OwnerTask {
  assignedToUserId: string | null;
  assigneeLabel: string | null;
  contactId: string | null;
  contactLabel: string | null;
  conversationId: string | null;
  createdByUserId: string | null;
  description: string | null;
  dueAt: string | null;
  id: string;
  isFollowing: boolean;
  metadata: Record<string, unknown>;
  postponedUntil: string | null;
  presupuestoId: string | null;
  priority: 'low' | 'normal' | 'high';
  reminderSnoozedUntil: string | null;
  status: OwnerTaskStatus;
  taskType: OwnerTaskType;
  title: string;
}

export interface OwnerNotification {
  body: string;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  notificationType: string;
  payload: {
    actionId?: string;
    actionType?: string;
    appointmentId?: string;
    assigneeName?: string | null;
    conversationId?: string;
    description?: string | null;
    dueAt?: string | null;
    invoiceId?: string;
    productId?: string;
    reorderThreshold?: number;
    stockQuantity?: number;
    taskId?: string;
    title?: string | null;
  };
  productId: string | null;
  productLabel: string | null;
  pushSentAt: string | null;
  status: 'pending' | 'sent' | 'failed' | 'dismissed';
  title: string;
}
