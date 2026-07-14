export type OwnerTaskStatus = 'pending' | 'completed' | 'snoozed' | 'cancelled';

export type OwnerTaskType = 'follow_up' | 'manual' | 'copi' | 'inventory' | 'callback';

export interface OwnerTask {
  contactLabel: string | null;
  conversationId: string | null;
  description: string | null;
  dueAt: string | null;
  id: string;
  priority: 'low' | 'normal' | 'high';
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
  notificationType: 'low_stock';
  payload: {
    productId?: string;
    reorderThreshold?: number;
    stockQuantity?: number;
  };
  productId: string | null;
  productLabel: string | null;
  pushSentAt: string | null;
  status: 'pending' | 'sent' | 'failed' | 'dismissed';
  title: string;
}
