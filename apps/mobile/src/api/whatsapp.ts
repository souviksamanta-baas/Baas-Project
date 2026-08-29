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

export interface SendConversationImageParams {
  body?: string;
  businessCenterId: string;
  conversationId: string;
  imageBase64: string;
  mimeType?: string;
  organizationId: string;
}

export async function sendConversationImage(
  params: SendConversationImageParams,
): Promise<SendConversationReplyResult> {
  return apiFetchAuthJson<SendConversationReplyResult>('/whatsapp/messages/send-image', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export interface SendConversationAudioParams {
  audioBase64: string;
  businessCenterId: string;
  conversationId: string;
  durationMs?: number;
  mimeType?: string;
  organizationId: string;
}

export async function sendConversationAudio(
  params: SendConversationAudioParams,
): Promise<SendConversationReplyResult> {
  return apiFetchAuthJson<SendConversationReplyResult>('/whatsapp/messages/send-audio', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function editConversationMessage(params: {
  body: string;
  businessCenterId: string;
  messageId: string;
  organizationId: string;
}): Promise<{ status: 'edited' }> {
  return apiFetchAuthJson('/whatsapp/messages/edit', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function reactToConversationMessage(params: {
  businessCenterId: string;
  emoji: string;
  messageId: string;
  organizationId: string;
}): Promise<{ status: 'reacted' }> {
  return apiFetchAuthJson('/whatsapp/messages/react', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function forwardConversationMessage(params: {
  businessCenterId: string;
  messageId: string;
  organizationId: string;
  targetConversationId: string;
}): Promise<SendConversationReplyResult> {
  return apiFetchAuthJson('/whatsapp/messages/forward', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}
