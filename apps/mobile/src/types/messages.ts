export interface WhatsAppMessagePreview {
  conversationId: string;
  id: string;
  body: string | null;
  createdAt: string;
  direction: 'inbound' | 'outbound';
  messageStatus: string;
  recipientPhone: string | null;
  senderPhone: string | null;
}

export interface ContactSummary {
  displayName: string | null;
  id: string | null;
  leadStatus: 'new' | 'active' | 'cold' | 'won' | 'lost' | null;
  phoneNumber: string | null;
}

export interface InboxConversationSummary {
  contact: ContactSummary;
  externalContactId: string;
  id: string;
  lastMessageAt: string | null;
  latestMessage: WhatsAppMessagePreview | null;
  status: 'open' | 'closed';
}
