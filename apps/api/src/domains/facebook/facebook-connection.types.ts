export interface FacebookConnectionSummary {
  lastError: string | null;
  lastStatusCheckAt: string | null;
  pageId: string | null;
  pageName: string | null;
  status: 'not_configured' | 'pending' | 'connected' | 'error' | 'disconnected';
  tokenExpiresAt?: string | null;
  verifiedAt: string | null;
}

export type FacebookMessagingWindowState =
  | 'customer_must_message_first'
  | 'reply_available'
  | 'human_reply_only'
  | 'window_expired'
  | 'meta_approval_required';
