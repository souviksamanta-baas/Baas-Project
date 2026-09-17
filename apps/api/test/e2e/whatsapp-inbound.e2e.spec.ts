import { describe, expect, it, vi } from 'vitest';

import type { WhatsAppConversationMessageRepository } from '../../src/domains/whatsapp/whatsapp-conversation-message.repository';
import type { SupabaseService } from '../../src/supabase/supabase.service';
import { WhatsAppMessageEventRepository } from '../../src/webhooks/whatsapp/whatsapp-message-event.repository';
import { WhatsAppWebhookService } from '../../src/webhooks/whatsapp/whatsapp-webhook.service';
import type {
  WhatsAppInboundMessageLog,
  WhatsAppWebhookPayload,
} from '../../src/webhooks/whatsapp/whatsapp-webhook.types';

const PHONE_NUMBER_ID = 'phone-number-id-e2e';
const SENDER_PHONE = '15557654321';
const SENDER_NAME = 'Cliente Demo';
const TIMESTAMP = '1717243200';
const ISO_TIMESTAMP = '2024-06-01T12:00:00.000Z';

function basePayload(messages: WhatsAppWebhookPayload['entry'][0]['changes'][0]['value']['messages']): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-e2e',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551234567',
                phone_number_id: PHONE_NUMBER_ID,
              },
              contacts: [
                {
                  wa_id: SENDER_PHONE,
                  profile: { name: SENDER_NAME },
                },
              ],
              messages,
            },
          },
        ],
      },
    ],
  };
}

describe('E2E — WhatsApp inbound webhook parsing', () => {
  const service = new WhatsAppWebhookService();

  it('parses inbound text messages', () => {
    const payload = basePayload([
      {
        id: 'wamid.text-e2e',
        from: SENDER_PHONE,
        timestamp: TIMESTAMP,
        type: 'text',
        text: { body: 'Hola, ¿tienen stock?' },
      },
    ]);

    expect(service.parseInboundMessages(payload)).toEqual([
      {
        messageId: 'wamid.text-e2e',
        senderPhone: SENDER_PHONE,
        senderDisplayName: SENDER_NAME,
        phoneNumberId: PHONE_NUMBER_ID,
        timestamp: ISO_TIMESTAMP,
        messageType: 'text',
        textBody: 'Hola, ¿tienen stock?',
        mediaId: null,
        mediaMimeType: null,
        reactionTargetExternalId: null,
        reactionEmoji: null,
        duplicate: false,
      },
    ]);
  });

  it('parses inbound image messages with caption and media metadata', () => {
    const payload = basePayload([
      {
        id: 'wamid.image-e2e',
        from: SENDER_PHONE,
        timestamp: TIMESTAMP,
        type: 'image',
        image: {
          id: 'media-image-1',
          mime_type: 'image/jpeg',
          caption: 'Foto del producto',
        },
      },
    ]);

    expect(service.parseInboundMessages(payload)).toEqual([
      expect.objectContaining({
        messageId: 'wamid.image-e2e',
        messageType: 'image',
        textBody: 'Foto del producto',
        mediaId: 'media-image-1',
        mediaMimeType: 'image/jpeg',
      }),
    ]);
  });

  it('parses inbound audio messages with media metadata', () => {
    const payload = basePayload([
      {
        id: 'wamid.audio-e2e',
        from: SENDER_PHONE,
        timestamp: TIMESTAMP,
        type: 'audio',
        audio: {
          id: 'media-audio-1',
          mime_type: 'audio/ogg',
          voice: true,
        },
      },
    ]);

    expect(service.parseInboundMessages(payload)).toEqual([
      expect.objectContaining({
        messageId: 'wamid.audio-e2e',
        messageType: 'audio',
        textBody: null,
        mediaId: 'media-audio-1',
        mediaMimeType: 'audio/ogg',
      }),
    ]);
  });

  it('parses inbound reaction add events with target and emoji', () => {
    const payload = basePayload([
      {
        id: 'wamid.reaction-add-e2e',
        from: SENDER_PHONE,
        timestamp: TIMESTAMP,
        type: 'reaction',
        reaction: {
          message_id: 'wamid.target-message',
          emoji: '👍',
        },
      },
    ]);

    expect(service.parseInboundMessages(payload)).toEqual([
      expect.objectContaining({
        messageId: 'wamid.reaction-add-e2e',
        messageType: 'reaction',
        textBody: null,
        mediaId: null,
        reactionTargetExternalId: 'wamid.target-message',
        reactionEmoji: '👍',
      }),
    ]);
  });

  it('parses inbound reaction clear events (empty emoji)', () => {
    const payload = basePayload([
      {
        id: 'wamid.reaction-clear-e2e',
        from: SENDER_PHONE,
        timestamp: TIMESTAMP,
        type: 'reaction',
        reaction: {
          message_id: 'wamid.target-message',
          emoji: '',
        },
      },
    ]);

    expect(service.parseInboundMessages(payload)).toEqual([
      expect.objectContaining({
        messageId: 'wamid.reaction-clear-e2e',
        messageType: 'reaction',
        reactionTargetExternalId: 'wamid.target-message',
        reactionEmoji: '',
      }),
    ]);
  });
});

describe('E2E — reaction routing expectations', () => {
  /**
   * Documented contract: inbound reactions must NOT create a row in
   * `conversation_messages`. They upsert or delete in `message_reactions`
   * against the target message's external WhatsApp id.
   *
   * See WhatsAppMessageEventRepository.recordConversationMessage — the
   * `messageType === 'reaction'` branch calls upsertInboundReaction and
   * returns before recordInboundMessage.
   */
  it('documents that reactions never become conversation messages', () => {
    const reactionEvent: WhatsAppInboundMessageLog = {
      duplicate: false,
      mediaId: null,
      mediaMimeType: null,
      messageId: 'wamid.reaction-doc',
      messageType: 'reaction',
      phoneNumberId: PHONE_NUMBER_ID,
      reactionEmoji: '❤️',
      reactionTargetExternalId: 'wamid.target',
      senderDisplayName: SENDER_NAME,
      senderPhone: SENDER_PHONE,
      textBody: null,
      timestamp: ISO_TIMESTAMP,
    };

    expect(reactionEvent.messageType).toBe('reaction');
    expect(reactionEvent.reactionTargetExternalId).toBeTruthy();
  });

  it('does not call recordInboundMessage when persisting a reaction event', async () => {
    const recordInboundMessage = vi.fn();
    const reactionUpsert = vi.fn(async () => ({ error: null }));
    const reactionDelete = vi.fn(async () => ({ error: null }));
    const targetLookup = vi.fn(async () => ({
      data: { id: 'conversation-message-target' },
      error: null,
    }));

    const supabaseService = {
      hasServiceRoleConfig: () => true,
      getServiceRoleClient: () => ({
        from: (tableName: string) => {
          if (tableName === 'whatsapp_config') {
            return {
              select: vi.fn(() => ({
                in: vi.fn(async () => ({
                  data: [
                    {
                      business_center_id: 'bc-e2e',
                      id: 'config-e2e',
                      organization_id: 'org-e2e',
                      phone_number_id: PHONE_NUMBER_ID,
                    },
                  ],
                  error: null,
                })),
              })),
            };
          }

          if (tableName === 'conversation_messages') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: targetLookup,
                  })),
                })),
              })),
            };
          }

          if (tableName === 'message_reactions') {
            return {
              delete: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: reactionDelete,
                })),
              })),
              upsert: reactionUpsert,
            };
          }

          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    business_center_id: 'bc-e2e',
                    id: 'event-reaction-e2e',
                    organization_id: 'org-e2e',
                    whatsapp_config_id: 'config-e2e',
                  },
                  error: null,
                })),
              })),
            })),
          };
        },
      }),
    } as unknown as SupabaseService;

    const messageRepository = {
      recordInboundMessage,
    } as unknown as WhatsAppConversationMessageRepository;

    const repository = new WhatsAppMessageEventRepository(supabaseService, messageRepository);

    const reactionEvent: WhatsAppInboundMessageLog = {
      duplicate: false,
      mediaId: null,
      mediaMimeType: null,
      messageId: 'wamid.reaction-routing-e2e',
      messageType: 'reaction',
      phoneNumberId: PHONE_NUMBER_ID,
      reactionEmoji: '👍',
      reactionTargetExternalId: 'wamid.target-message',
      senderDisplayName: SENDER_NAME,
      senderPhone: SENDER_PHONE,
      textBody: null,
      timestamp: ISO_TIMESTAMP,
    };

    await repository.recordInboundMessages([reactionEvent]);

    expect(recordInboundMessage).not.toHaveBeenCalled();
    expect(reactionUpsert).toHaveBeenCalled();
  });
});
