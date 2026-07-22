import { describe, expect, it, vi } from 'vitest';

import type { SalesAiService } from '../src/domains/ai/sales-ai.service';
import type { WhatsAppConversationMessageRepository } from '../src/domains/whatsapp/whatsapp-conversation-message.repository';
import type { SupabaseService } from '../src/supabase/supabase.service';
import { WhatsAppMessageEventRepository } from '../src/webhooks/whatsapp/whatsapp-message-event.repository';
import type { WhatsAppInboundMessageLog } from '../src/webhooks/whatsapp/whatsapp-webhook.types';

const inboundEvents: WhatsAppInboundMessageLog[] = [
  {
    duplicate: false,
    mediaId: null,
    mediaMimeType: null,
    messageId: 'wamid.1',
    messageType: 'text',
    phoneNumberId: 'phone-number-1',
    senderDisplayName: 'Ana Customer',
    senderPhone: '+15555550101',
    textBody: 'Hello',
    timestamp: '2026-06-05T18:00:00.000Z',
  },
  {
    duplicate: false,
    mediaId: null,
    mediaMimeType: null,
    messageId: 'wamid.2',
    messageType: 'text',
    phoneNumberId: 'phone-number-1',
    senderDisplayName: 'Ana Customer',
    senderPhone: '+15555550101',
    textBody: 'Do you have stock?',
    timestamp: '2026-06-05T18:00:05.000Z',
  },
];

describe('WhatsAppMessageEventRepository', () => {
  it('batch-resolves WhatsApp config and preserves persisted event order', async () => {
    const configLookup = vi.fn(async (_field: string, phoneNumberIds: string[]) => ({
      data: [
        {
          business_center_id: 'business-center-1',
          id: 'whatsapp-config-1',
          organization_id: 'organization-1',
          phone_number_id: phoneNumberIds[0],
        },
      ],
      error: null,
    }));
    const insertedRows: unknown[] = [];
    const eventInsert = vi.fn((row: { message_id: string }) => {
      insertedRows.push(row);
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              business_center_id: 'business-center-1',
              id: `event-${row.message_id}`,
              organization_id: 'organization-1',
              whatsapp_config_id: 'whatsapp-config-1',
            },
            error: null,
          })),
        })),
      };
    });
    const supabaseService = {
      getServiceRoleClient: () => ({
        from: (tableName: string) => {
          if (tableName === 'whatsapp_config') {
            return {
              select: vi.fn(() => ({
                in: configLookup,
              })),
            };
          }

          return {
            insert: eventInsert,
          };
        },
      }),
      hasServiceRoleConfig: () => true,
    } as unknown as SupabaseService;
    const messageRepository = {
      recordInboundMessage: vi.fn(async () => ({
        conversationId: 'conversation-1',
        conversationMessageId: 'conversation-message-1',
      })),
    } as unknown as WhatsAppConversationMessageRepository;
    const salesAiService = {
      handleInboundMessage: vi.fn(async () => undefined),
    } as unknown as SalesAiService;

    const repository = new WhatsAppMessageEventRepository(
      supabaseService,
      messageRepository,
      salesAiService,
    );

    await expect(repository.recordInboundMessages(inboundEvents)).resolves.toEqual([
      { ...inboundEvents[0], duplicate: false },
      { ...inboundEvents[1], duplicate: false },
    ]);

    expect(configLookup).toHaveBeenCalledTimes(1);
    expect(configLookup).toHaveBeenCalledWith('phone_number_id', ['phone-number-1']);
    expect(eventInsert).toHaveBeenCalledTimes(2);
    expect(insertedRows).toEqual([
      expect.objectContaining({
        business_center_id: 'business-center-1',
        message_id: 'wamid.1',
        organization_id: 'organization-1',
        whatsapp_config_id: 'whatsapp-config-1',
      }),
      expect.objectContaining({
        business_center_id: 'business-center-1',
        message_id: 'wamid.2',
        organization_id: 'organization-1',
        whatsapp_config_id: 'whatsapp-config-1',
      }),
    ]);
    expect(messageRepository.recordInboundMessage).toHaveBeenCalledTimes(2);
  });
});
