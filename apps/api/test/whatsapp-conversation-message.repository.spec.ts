import { describe, expect, it, vi } from 'vitest';

import { WhatsAppConversationMessageRepository } from '../src/domains/whatsapp/whatsapp-conversation-message.repository';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('WhatsAppConversationMessageRepository', () => {
  it('upserts a contact, links the conversation, and persists inbound messages', async () => {
    const contactUpsert = vi.fn();
    const conversationUpsert = vi.fn();
    const messageInsert = vi.fn(async () => ({ error: null }));
    const client = {
      from: (tableName: string) => {
        if (tableName === 'contacts') {
          return {
            upsert: vi.fn((row, options) => {
              contactUpsert(row, options);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { id: 'contact-1' }, error: null })),
                })),
              };
            }),
          };
        }

        if (tableName === 'conversations') {
          return {
            upsert: vi.fn((row, options) => {
              conversationUpsert(row, options);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { id: 'conversation-1' }, error: null })),
                })),
              };
            }),
          };
        }

        return {
          insert: messageInsert,
        };
      },
    };
    const supabaseService = {
      getServiceRoleClient: () => client,
    } as unknown as SupabaseService;
    const repository = new WhatsAppConversationMessageRepository(supabaseService);

    await repository.recordInboundMessage({
      eventId: 'event-1',
      organizationId: 'organization-1',
      whatsappConfigId: 'whatsapp-config-1',
      messageId: 'wamid.inbound-1',
      senderDisplayName: 'Test Sender',
      senderPhone: '15557654321',
      textBody: 'Hello',
      timestamp: '2026-06-05T19:03:05.000Z',
      messageType: 'text',
    });

    expect(contactUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'organization-1',
        channel: 'whatsapp',
        external_contact_id: '15557654321',
        display_name: 'Test Sender',
      }),
      {
        onConflict: 'organization_id,channel,external_contact_id',
      },
    );
    expect(conversationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'organization-1',
        contact_id: 'contact-1',
        external_contact_id: '15557654321',
      }),
      {
        onConflict: 'organization_id,channel,external_contact_id',
      },
    );
    expect(messageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'organization-1',
        conversation_id: 'conversation-1',
        external_message_id: 'wamid.inbound-1',
      }),
    );
  });
});
