export type OwnerTaskStatus = 'pending' | 'completed' | 'snoozed' | 'cancelled';

export type OwnerTaskType = 'follow_up' | 'manual' | 'copi' | 'inventory' | 'callback';

export interface OwnerTask {
  contactLabel: string | null;
  conversationId: string | null;
  description: string | null;
  dueAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high';
  presupuestoId: string | null;
  snoozedUntil: string | null;
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
    appointmentId?: string;
    conversationId?: string;
    invoiceId?: string;
    productId?: string;
    reorderThreshold?: number;
    stockQuantity?: number;
    taskId?: string;
  };
  productId: string | null;
  productLabel: string | null;
  pushSentAt: string | null;
  status: 'pending' | 'sent' | 'failed' | 'dismissed';
  title: string;
}
