import { describe, expect, it, vi } from 'vitest';

import { NotificationsService } from '../../src/domains/notifications/notifications.service';
import type { SupabaseService } from '../../src/supabase/supabase.service';

function createNotificationsService(conversation: { muted_until: string | null } | null): {
  service: NotificationsService;
  emitSpy: ReturnType<typeof vi.fn>;
} {
  const emitSpy = vi.fn(async () => ({ notificationId: 'notif-e2e', pushSent: 0, pushFailed: 0 }));

  const conversationQuery = {
    select: vi.fn(() => conversationQuery),
    eq: vi.fn(() => conversationQuery),
    maybeSingle: vi.fn(async () => ({ data: conversation, error: null })),
  };

  const supabaseService = {
    getServiceRoleClient: () => ({
      from: (table: string) => {
        if (table === 'conversations') {
          return conversationQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    }),
  } as unknown as SupabaseService;

  const service = new NotificationsService(supabaseService);
  vi.spyOn(service, 'emit').mockImplementation(emitSpy);

  return { service, emitSpy };
}

describe('E2E — conversation mute skips inbox notifications', () => {
  it('skips notifyInboxNewMessage when conversation is muted', async () => {
    const futureMute = new Date(Date.now() + 60 * 60_000).toISOString();
    const { service, emitSpy } = createNotificationsService({ muted_until: futureMute });

    await service.notifyInboxNewMessage({
      bodyPreview: 'Hola',
      businessCenterId: 'bc-e2e',
      conversationId: 'conv-e2e',
      messageId: 'msg-e2e',
      organizationId: 'org-e2e',
      senderLabel: 'Cliente',
    });

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('emits inbox notification when conversation is not muted', async () => {
    const { service, emitSpy } = createNotificationsService({ muted_until: null });

    await service.notifyInboxNewMessage({
      bodyPreview: 'Consulta de stock',
      businessCenterId: 'bc-e2e',
      conversationId: 'conv-e2e',
      messageId: 'msg-e2e',
      organizationId: 'org-e2e',
      senderLabel: 'María',
    });

    expect(emitSpy).toHaveBeenCalledOnce();
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'inbox.new_message',
        body: 'María: Consulta de stock',
      }),
    );
  });

  it('emits inbox notification when mute window has expired', async () => {
    const pastMute = new Date(Date.now() - 60_000).toISOString();
    const { service, emitSpy } = createNotificationsService({ muted_until: pastMute });

    await service.notifyInboxNewMessage({
      bodyPreview: '¿Precio?',
      businessCenterId: 'bc-e2e',
      conversationId: 'conv-e2e',
      messageId: 'msg-e2e',
      organizationId: 'org-e2e',
      senderLabel: 'Juan',
    });

    expect(emitSpy).toHaveBeenCalledOnce();
  });
});
