export interface InstagramConnectionSummary {
  igUserId: string | null;
  igUsername: string | null;
  lastError: string | null;
  lastStatusCheckAt: string | null;
  pageId: string | null;
  profilePictureUrl?: string | null;
  status: 'not_configured' | 'pending' | 'connected' | 'error' | 'disabled';
  tokenExpiresAt?: string | null;
  verifiedAt: string | null;
}

export type InstagramMessagingWindowState =
  | 'customer_must_message_first'
  | 'reply_available'
  | 'human_reply_only'
  | 'window_expired'
  | 'meta_approval_required';
