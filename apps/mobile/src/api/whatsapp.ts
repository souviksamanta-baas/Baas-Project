import type { OwnerDashboard } from '../types/dashboard';
import { whatsappConnectionLabel } from '../lib/whatsappPresentation';
import { apiFetchAuthJson } from './client';

export interface RegisterWhatsAppConnectionParams {
  displayPhoneNumber: string;
  organizationId: string;
  phoneNumberId: string;
  wabaId?: string;
}

export interface RegisterWhatsAppConnectionResult {
  displayPhoneNumber: string | null;
  lastError: string | null;
  phoneNumberId: string;
  status: OwnerDashboard['whatsappConnection']['status'];
  verifiedAt: string | null;
}

export interface SendConversationReplyParams {
  body: string;
  businessCenterId: string;
  conversationId: string;
  organizationId: string;
}

export interface SendConversationReplyResult {
  externalMessageId: string | null;
  status: 'sent';
}

export async function sendConversationReply(
  params: SendConversationReplyParams,
): Promise<SendConversationReplyResult> {
  return apiFetchAuthJson<SendConversationReplyResult>('/whatsapp/messages/send', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function registerWhatsAppConnection(
  params: RegisterWhatsAppConnectionParams,
): Promise<RegisterWhatsAppConnectionResult> {
  return apiFetchAuthJson<RegisterWhatsAppConnectionResult>('/whatsapp/connection/register', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export { whatsappConnectionLabel };
