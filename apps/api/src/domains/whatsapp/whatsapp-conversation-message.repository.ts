import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

interface ConversationRecord {
  id: string;
}

export interface RecordInboundWhatsAppMessageParams {
  eventId: string;
  organizationId: string;
  whatsappConfigId: string;
  messageId: string;
  senderDisplayName: string | null;
  senderPhone: string;
  textBody: string | null;
  timestamp: string | null;
  messageType: string;
}

export interface RecordOutboundWhatsAppMessageParams {
  body: string;
  errorMessage?: string;
  externalMessageId?: string;
  organizationId: string;
  recipientPhone: string;
  senderPhone: string | null;
  sentAt?: string;
  status: 'pending' | 'sent' | 'failed';
  whatsappConfigId: string;
}

@Injectable()
export class WhatsAppConversationMessageRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async recordInboundMessage(params: RecordInboundWhatsAppMessageParams): Promise<void> {
    const conversation = await this.upsertConversation({
      organizationId: params.organizationId,
      whatsappConfigId: params.whatsappConfigId,
      externalContactId: params.senderPhone,
      customerDisplayName: params.senderDisplayName,
      lastMessageAt: params.timestamp,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('conversation_messages').insert({
      organization_id: params.organizationId,
      conversation_id: conversation.id,
      whatsapp_message_event_id: params.eventId,
      direction: 'inbound',
      external_message_id: params.messageId,
      sender_phone: params.senderPhone,
      message_type: params.messageType,
      body: params.textBody,
      message_status: 'received',
      received_at: params.timestamp,
      metadata: {
        source: 'whatsapp_cloud_api',
      },
    });

    if (error && error.code !== '23505') {
      throw new Error(`Failed to persist inbound WhatsApp message: ${error.message}`);
    }
  }

  async recordOutboundMessage(params: RecordOutboundWhatsAppMessageParams): Promise<void> {
    const sentAt = params.sentAt ?? new Date().toISOString();
    const conversation = await this.upsertConversation({
      organizationId: params.organizationId,
      whatsappConfigId: params.whatsappConfigId,
      externalContactId: params.recipientPhone,
      customerDisplayName: null,
      lastMessageAt: sentAt,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('conversation_messages').insert({
      organization_id: params.organizationId,
      conversation_id: conversation.id,
      direction: 'outbound',
      external_message_id: params.externalMessageId,
      sender_phone: params.senderPhone,
      recipient_phone: params.recipientPhone,
      message_type: 'text',
      body: params.body,
      message_status: params.status,
      sent_at: params.status === 'sent' ? sentAt : null,
      failed_at: params.status === 'failed' ? sentAt : null,
      error_message: params.errorMessage,
      metadata: {
        source: 'whatsapp_cloud_api',
      },
    });

    if (error && error.code !== '23505') {
      throw new Error(`Failed to persist outbound WhatsApp message: ${error.message}`);
    }
  }

  private async upsertConversation(params: {
    customerDisplayName: string | null;
    externalContactId: string;
    lastMessageAt: string | null;
    organizationId: string;
    whatsappConfigId: string;
  }): Promise<ConversationRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversations')
      .upsert(
        {
          organization_id: params.organizationId,
          whatsapp_config_id: params.whatsappConfigId,
          channel: 'whatsapp',
          external_contact_id: params.externalContactId,
          customer_display_name: params.customerDisplayName,
          last_message_at: params.lastMessageAt,
        },
        {
          onConflict: 'organization_id,channel,external_contact_id',
        },
      )
      .select('id')
      .single<ConversationRecord>();

    if (error) {
      throw new Error(`Failed to upsert WhatsApp conversation: ${error.message}`);
    }

    return data;
  }
}
