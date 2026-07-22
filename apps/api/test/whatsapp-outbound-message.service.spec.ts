import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupabaseService } from '../src/supabase/supabase.service';
import { WhatsAppConversationMessageRepository } from '../src/domains/whatsapp/whatsapp-conversation-message.repository';
import { WhatsAppMediaService } from '../src/domains/whatsapp/whatsapp-media.service';
import { WhatsAppOutboundMessageService } from '../src/domains/whatsapp/whatsapp-outbound-message.service';

function createSupabaseService(config: Record<string, unknown> | null): SupabaseService {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: config, error: null })),
  };

  return {
    getServiceRoleClient: () => ({
      from: () => query,
    }),
  } as unknown as SupabaseService;
}

describe('WhatsAppOutboundMessageService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a text message through WhatsApp Cloud API and records the sent message', async () => {
    const recordOutboundMessage = vi.fn(async () => undefined);
    const service = new WhatsAppOutboundMessageService(
      createSupabaseService({
        business_center_id: 'business-center-1',
        id: 'whatsapp-config-1',
        organization_id: 'organization-1',
        phone_number_id: 'phone-number-id-1',
        display_phone_number: '15551234567',
        access_token_encrypted: 'server-token',
        connection_status: 'connected',
      }),
      { recordOutboundMessage } as unknown as WhatsAppConversationMessageRepository,
      {} as unknown as WhatsAppMediaService,
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.outbound-1' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      service.sendTextMessage({
        businessCenterId: 'business-center-1',
        organizationId: 'organization-1',
        recipientPhone: '15557654321',
        body: 'Thanks for your message.',
      }),
    ).resolves.toEqual({
      externalMessageId: 'wamid.outbound-1',
      status: 'sent',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/phone-number-id-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer server-token',
        }),
      }),
    );
    expect(recordOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        externalMessageId: 'wamid.outbound-1',
        status: 'sent',
      }),
    );
  });

  it('records failed outbound attempts when WhatsApp Cloud API rejects the send', async () => {
    const recordOutboundMessage = vi.fn(async () => undefined);
    const service = new WhatsAppOutboundMessageService(
      createSupabaseService({
        business_center_id: 'business-center-1',
        id: 'whatsapp-config-1',
        organization_id: 'organization-1',
        phone_number_id: 'phone-number-id-1',
        display_phone_number: '15551234567',
        access_token_encrypted: 'server-token',
        connection_status: 'connected',
      }),
      { recordOutboundMessage } as unknown as WhatsAppConversationMessageRepository,
      {} as unknown as WhatsAppMediaService,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: 'Invalid recipient' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    await expect(
      service.sendTextMessage({
        businessCenterId: 'business-center-1',
        organizationId: 'organization-1',
        recipientPhone: 'invalid',
        body: 'Hello',
      }),
    ).rejects.toThrow('Invalid recipient');

    expect(recordOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'Invalid recipient',
        status: 'failed',
      }),
    );
  });
});
