import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupabaseService } from '../../src/supabase/supabase.service';
import { WhatsAppConversationMessageRepository } from '../../src/domains/whatsapp/whatsapp-conversation-message.repository';
import { WhatsAppMediaService } from '../../src/domains/whatsapp/whatsapp-media.service';
import { WhatsAppOutboundMessageService } from '../../src/domains/whatsapp/whatsapp-outbound-message.service';

const CONNECTED_CONFIG = {
  business_center_id: 'business-center-e2e',
  id: 'whatsapp-config-e2e',
  organization_id: 'organization-e2e',
  phone_number_id: 'phone-number-id-e2e',
  display_phone_number: '15551234567',
  access_token_encrypted: 'test-access-token',
  connection_status: 'connected' as const,
};

function createSupabaseService(config: Record<string, unknown> | null): SupabaseService {
  const whatsappQuery = {
    select: vi.fn(() => whatsappQuery),
    eq: vi.fn(() => whatsappQuery),
    maybeSingle: vi.fn(async () => ({ data: config, error: null })),
  };

  const reactionsQuery = {
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
    upsert: vi.fn(async () => ({ error: null })),
  };

  return {
    getServiceRoleClient: () => ({
      from: (table: string) => {
        if (table === 'message_reactions') {
          return reactionsQuery;
        }
        return whatsappQuery;
      },
    }),
  } as unknown as SupabaseService;
}

function createOutboundService(supabaseService: SupabaseService): WhatsAppOutboundMessageService {
  return new WhatsAppOutboundMessageService(
    supabaseService,
    {
      getMessageById: vi.fn(async () => ({
        id: 'msg-e2e-1',
        externalMessageId: 'wamid.target-outbound',
        direction: 'outbound',
        messageType: 'text',
      })),
      recordOutboundMessage: vi.fn(async () => undefined),
    } as unknown as WhatsAppConversationMessageRepository,
    {
      decodeBase64Audio: vi.fn(() => ({
        buffer: Buffer.from('fake-audio'),
        mimeType: 'audio/ogg',
      })),
      storeMedia: vi.fn(async () => ({
        mediaMimeType: 'audio/ogg',
        mediaStoragePath: 'path/audio.ogg',
        mediaUrl: 'https://example.com/audio.ogg',
      })),
      uploadToMeta: vi.fn(async () => 'meta-media-id-audio'),
      extensionForMime: vi.fn(() => 'ogg'),
    } as unknown as WhatsAppMediaService,
  );
}

describe('E2E — WhatsApp outbound Meta payload shapes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a reaction payload with message_id and emoji to Meta Cloud API', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: 'wamid.reaction-sent' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = createOutboundService(createSupabaseService(CONNECTED_CONFIG));

    await expect(
      service.reactToMessage({
        businessCenterId: 'business-center-e2e',
        emoji: '❤️',
        messageId: 'msg-e2e-1',
        organizationId: 'organization-e2e',
        recipientPhone: '15557654321',
      }),
    ).resolves.toEqual({ status: 'reacted' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.method).toBe('POST');

    const body = JSON.parse(String(requestInit.body));
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '15557654321',
      type: 'reaction',
      reaction: {
        message_id: 'wamid.target-outbound',
        emoji: '❤️',
      },
    });
  });

  it('sends an audio payload with uploaded media id to Meta Cloud API', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: 'wamid.audio-sent' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = createOutboundService(createSupabaseService(CONNECTED_CONFIG));

    await expect(
      service.sendAudioMessage({
        audioBase64: Buffer.from('fake-audio').toString('base64'),
        businessCenterId: 'business-center-e2e',
        conversationId: 'conversation-e2e',
        durationMs: 4500,
        mimeType: 'audio/ogg',
        organizationId: 'organization-e2e',
        recipientPhone: '15557654321',
      }),
    ).resolves.toEqual({
      externalMessageId: 'wamid.audio-sent',
      status: 'sent',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(body).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '15557654321',
      type: 'audio',
      audio: {
        id: 'meta-media-id-audio',
      },
    });
  });

  it('sends a reaction clear payload with empty emoji', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: 'wamid.reaction-cleared' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = createOutboundService(createSupabaseService(CONNECTED_CONFIG));

    await expect(
      service.reactToMessage({
        businessCenterId: 'business-center-e2e',
        emoji: '',
        messageId: 'msg-e2e-1',
        organizationId: 'organization-e2e',
        recipientPhone: '15557654321',
      }),
    ).resolves.toEqual({ status: 'reacted' });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(body.reaction).toEqual({
      message_id: 'wamid.target-outbound',
      emoji: '',
    });
  });
});
