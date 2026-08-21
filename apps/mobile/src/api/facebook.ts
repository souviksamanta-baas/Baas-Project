import { apiFetchAuthJson } from './client';

export type FacebookConnectionSummary = {
  lastError: string | null;
  lastStatusCheckAt: string | null;
  pageId: string | null;
  pageName: string | null;
  status: 'not_configured' | 'pending' | 'connected' | 'error' | 'disconnected';
  tokenExpiresAt?: string | null;
  verifiedAt: string | null;
};

export type FacebookMessagingWindowState =
  | 'customer_must_message_first'
  | 'reply_available'
  | 'human_reply_only'
  | 'window_expired'
  | 'meta_approval_required';

export async function startFacebookOAuth(params: {
  organizationId: string;
}): Promise<{ authUrl: string; redirectUri: string; state: string }> {
  return apiFetchAuthJson('/facebook/oauth/start', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function completeFacebookOAuth(params: {
  code: string;
  pageId?: string;
  state: string;
}): Promise<FacebookConnectionSummary> {
  return apiFetchAuthJson('/facebook/oauth/callback', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function disconnectFacebook(params: {
  organizationId: string;
}): Promise<{ disconnected: true }> {
  return apiFetchAuthJson('/facebook/connection/disconnect', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function getFacebookMessagingWindowState(params: {
  conversationId: string;
  organizationId: string;
}): Promise<{
  expiresAt: string | null;
  lastInboundAt: string | null;
  state: FacebookMessagingWindowState;
}> {
  const query = new URLSearchParams({
    conversationId: params.conversationId,
    organizationId: params.organizationId,
  });
  return apiFetchAuthJson(`/facebook/messages/window-state?${query.toString()}`, {
    method: 'GET',
  });
}

export async function sendFacebookReply(params: {
  body: string;
  businessCenterId: string;
  conversationId: string;
  organizationId: string;
}): Promise<{ externalMessageId: string | null; status: 'sent' }> {
  return apiFetchAuthJson('/facebook/messages/send', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export function facebookWindowComposerCopy(
  state: FacebookMessagingWindowState,
): { blocked: boolean; message: string } {
  switch (state) {
    case 'reply_available':
      return { blocked: false, message: '' };
    case 'customer_must_message_first':
      return {
        blocked: true,
        message: 'El cliente tiene que escribir primero por Facebook Messenger.',
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
