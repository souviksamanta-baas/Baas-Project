export type OwnerTaskStatus = 'pending' | 'completed' | 'snoozed' | 'cancelled';

export interface OwnerTask {
  contactLabel: string | null;
  conversationId: string | null;
  description: string | null;
  dueAt: string | null;
  id: string;
  snoozedUntil: string | null;
  status: OwnerTaskStatus;
  title: string;
}

export interface OwnerNotification {
  body: string;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  productLabel: string | null;
  pushSentAt: string | null;
  status: 'pending' | 'sent' | 'failed' | 'dismissed';
  title: string;
}
