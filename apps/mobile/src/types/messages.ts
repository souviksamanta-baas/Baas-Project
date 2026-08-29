export type LeadStatus =
  | 'new'
  | 'active'
  | 'cold'
  | 'won'
  | 'lost'
  | 'opportunity'
  | 'finished'
  | null;

export interface WhatsAppMessagePreview {
  conversationId: string;
  id: string;
  body: string | null;
  createdAt: string;
  direction: 'inbound' | 'outbound';
  editedAt?: string | null;
  linkPreview?: {
    description?: string | null;
    imageUrl?: string | null;
    title?: string | null;
    url?: string | null;
  } | null;
  mediaDurationMs?: number | null;
  mediaMimeType: string | null;
  mediaStoragePath: string | null;
  mediaUrl: string | null;
  messageStatus: string;
  messageType: string;
  recipientPhone: string | null;
  replyToMessageId?: string | null;
  senderPhone: string | null;
}

export interface ContactSummary {
  displayName: string | null;
  id: string | null;
  leadStatus: LeadStatus;
  phoneNumber: string | null;
}

export type ConversationChannel = 'email' | 'facebook' | 'instagram' | 'whatsapp';

export interface InboxConversationSummary {
  archivedAt: string | null;
  channel: ConversationChannel;
  contact: ContactSummary;
  deletedAt: string | null;
  externalContactId: string;
  id: string;
  lastMessageAt: string | null;
  lastOwnerReadAt: string | null;
  latestMessage: WhatsAppMessagePreview | null;
  messagesClearedAt: string | null;
  status: 'open' | 'closed';
  unreadCount: number;
}
