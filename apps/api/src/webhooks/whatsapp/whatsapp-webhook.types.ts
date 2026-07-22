export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id?: string;
  changes?: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  field?: string;
  value?: WhatsAppWebhookChangeValue;
}

export interface WhatsAppWebhookChangeValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    wa_id?: string;
    profile?: {
      name?: string;
    };
  }>;
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatusUpdate[];
}

export interface WhatsAppStatusUpdate {
  id?: string;
  recipient_id?: string;
  status?: string;
  timestamp?: string;
}

export interface WhatsAppMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: {
    body?: string;
  };
  image?: {
    id?: string;
    mime_type?: string;
    caption?: string;
    sha256?: string;
  };
}

export interface WhatsAppInboundMessageLog {
  messageId: string;
  senderPhone: string;
  senderDisplayName: string | null;
  phoneNumberId: string;
  timestamp: string | null;
  messageType: string;
  textBody: string | null;
  mediaId: string | null;
  mediaMimeType: string | null;
  duplicate: boolean;
}

export interface WhatsAppMessageStatusLog {
  externalMessageId: string;
  messageStatus: 'delivered' | 'read' | 'failed' | 'sent';
  phoneNumberId: string;
  recipientPhone: string | null;
  timestamp: string | null;
}

export interface WhatsAppWebhookResponse {
  received: true;
  eventCount: number;
}
