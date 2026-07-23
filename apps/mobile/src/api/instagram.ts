import { apiFetchAuthJson } from './client';

export type InstagramConnectionSummary = {
  igUserId: string | null;
  igUsername: string | null;
  lastError: string | null;
  lastStatusCheckAt: string | null;
  pageId: string | null;
  profilePictureUrl?: string | null;
  status: 'not_configured' | 'pending' | 'connected' | 'error' | 'disabled';
  tokenExpiresAt?: string | null;
  verifiedAt: string | null;
};

export type InstagramMessagingWindowState =
  | 'customer_must_message_first'
  | 'reply_available'
  | 'human_reply_only'
  | 'window_expired'
  | 'meta_approval_required';

export async function startInstagramOAuth(params: {
  organizationId: string;
}): Promise<{ authUrl: string; state: string }> {
  return apiFetchAuthJson('/instagram/oauth/start', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function completeInstagramOAuth(params: {
  code: string;
  state: string;
}): Promise<InstagramConnectionSummary> {
  return apiFetchAuthJson('/instagram/oauth/callback', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function disconnectInstagram(params: {
  organizationId: string;
}): Promise<{ disconnected: true }> {
  return apiFetchAuthJson('/instagram/connection/disconnect', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function getInstagramMessagingWindowState(params: {
  conversationId: string;
  organizationId: string;
}): Promise<{
  expiresAt: string | null;
  lastInboundAt: string | null;
  state: InstagramMessagingWindowState;
}> {
  const query = new URLSearchParams({
    conversationId: params.conversationId,
    organizationId: params.organizationId,
  });
  return apiFetchAuthJson(`/instagram/messages/window-state?${query.toString()}`, {
    method: 'GET',
  });
}

export async function sendInstagramReply(params: {
  body: string;
  businessCenterId: string;
  conversationId: string;
  organizationId: string;
}): Promise<{ externalMessageId: string | null; status: 'sent' }> {
  return apiFetchAuthJson('/instagram/messages/send', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export function instagramWindowComposerCopy(
  state: InstagramMessagingWindowState,
): { blocked: boolean; message: string } {
  switch (state) {
    case 'reply_available':
      return { blocked: false, message: '' };
    case 'customer_must_message_first':
      return {
        blocked: true,
        message: 'El cliente tiene que escribir primero por Instagram.',
      };
    case 'window_expired':
      return {
        blocked: true,
        message: 'La ventana de 24 horas expiró. Esperá un nuevo mensaje del cliente.',
      };
    case 'human_reply_only':
      return {
        blocked: true,
        message: 'Solo un agente humano puede responder en esta ventana.',
      };
    case 'meta_approval_required':
      return {
        blocked: true,
        message: 'Meta aún no aprobó Advanced Access para esta app.',
      };
    default:
      return { blocked: true, message: 'No se puede enviar el mensaje ahora.' };
  }
}
