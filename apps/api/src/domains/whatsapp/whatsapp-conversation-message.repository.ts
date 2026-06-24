import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

interface ConversationRecord {
  id: string;
}

interface ContactRecord {
  id: string;
}

export interface RecordInboundWhatsAppMessageResult {
  conversationId: string;
  conversationMessageId: string | null;
}

export interface RecordInboundWhatsAppMessageParams {
  businessCenterId: string;
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
  businessCenterId: string;
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

  async recordInboundMessage(
    params: RecordInboundWhatsAppMessageParams,
  ): Promise<RecordInboundWhatsAppMessageResult> {
    const conversation = await this.upsertConversation({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      whatsappConfigId: params.whatsappConfigId,
      externalContactId: params.senderPhone,
      customerDisplayName: params.senderDisplayName,
      lastMessageAt: params.timestamp,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversation_messages')
      .insert({
        organization_id: params.organizationId,
        business_center_id: params.businessCenterId,
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
      })
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error && error.code !== '23505') {
      throw new Error(`Failed to persist inbound WhatsApp message: ${error.message}`);
    }

    return {
      conversationId: conversation.id,
      conversationMessageId: data?.id ?? null,
    };
  }

  async updateMessageStatusByExternalId(params: {
    externalMessageId: string;
    messageStatus: 'delivered' | 'failed' | 'read' | 'sent';
    timestamp?: string | null;
  }): Promise<boolean> {
    const client = this.supabaseService.getServiceRoleClient();
    const timestamp = params.timestamp ?? new Date().toISOString();
    const patch: Record<string, string | null> = {
      message_status: params.messageStatus,
      updated_at: timestamp,
    };

    if (params.messageStatus === 'sent') {
      patch.sent_at = timestamp;
    }

    if (params.messageStatus === 'failed') {
      patch.failed_at = timestamp;
    }

    const { data, error } = await client
      .from('conversation_messages')
      .update(patch)
      .eq('external_message_id', params.externalMessageId)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(`Failed to update WhatsApp message status: ${error.message}`);
    }

    return Boolean(data?.id);
  }

  async recordOutboundMessage(params: RecordOutboundWhatsAppMessageParams): Promise<void> {
    const sentAt = params.sentAt ?? new Date().toISOString();
    const conversation = await this.upsertConversation({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      whatsappConfigId: params.whatsappConfigId,
      externalContactId: params.recipientPhone,
      customerDisplayName: null,
      lastMessageAt: sentAt,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('conversation_messages').insert({
      organization_id: params.organizationId,
      business_center_id: params.businessCenterId,
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
    businessCenterId: string;
    customerDisplayName: string | null;
    externalContactId: string;
    lastMessageAt: string | null;
    organizationId: string;
    whatsappConfigId: string;
  }): Promise<ConversationRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const contact = await this.upsertContact({
      customerDisplayName: params.customerDisplayName,
      businessCenterId: params.businessCenterId,
      externalContactId: params.externalContactId,
      lastSeenAt: params.lastMessageAt,
      organizationId: params.organizationId,
    });
    const { data, error } = await client
      .from('conversations')
      .upsert(
        {
          organization_id: params.organizationId,
          business_center_id: params.businessCenterId,
          whatsapp_config_id: params.whatsappConfigId,
          contact_id: contact.id,
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

  private async upsertContact(params: {
    businessCenterId: string;
    customerDisplayName: string | null;
    externalContactId: string;
    lastSeenAt: string | null;
    organizationId: string;
  }): Promise<ContactRecord> {
    const seenAt = params.lastSeenAt ?? new Date().toISOString();
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('contacts')
      .upsert(
        {
          organization_id: params.organizationId,
          business_center_id: params.businessCenterId,
          channel: 'whatsapp',
          external_contact_id: params.externalContactId,
          phone_number: params.externalContactId,
          display_name: params.customerDisplayName ?? params.externalContactId,
          last_seen_at: seenAt,
          metadata: {
            source: 'whatsapp_cloud_api',
          },
        },
        {
          onConflict: 'organization_id,channel,external_contact_id',
        },
      )
      .select('id')
      .single<ContactRecord>();

    if (error) {
      throw new Error(`Failed to upsert WhatsApp contact: ${error.message}`);
    }

    return data;
  }
}
