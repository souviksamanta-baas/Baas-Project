export interface WhatsAppMessagePreview {
  id: string;
  body: string | null;
  createdAt: string;
  direction: 'inbound' | 'outbound';
  messageStatus: string;
  recipientPhone: string | null;
  senderPhone: string | null;
}
