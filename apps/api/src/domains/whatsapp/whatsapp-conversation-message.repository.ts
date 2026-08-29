import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { extractFirstUrl, fetchLinkPreview } from './whatsapp-link-preview.util';

interface ConversationRecord {
  contactId: string | null;
  id: string;
}

interface ContactRecord {
  id: string;
  cold_at?: string | null;
  lead_status?: string | null;
}

export interface RecordInboundWhatsAppMessageResult {
  conversationId: string;
  conversationMessageId: string | null;
}

export interface RecordInboundWhatsAppMessageParams {
  businessCenterId: string;
  eventId: string;
  mediaId?: string | null;
  mediaMimeType?: string | null;
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
  body: string | null;
  businessCenterId: string;
  errorMessage?: string;
  externalMessageId?: string;
  linkPreview?: {
    description: string | null;
    imageUrl: string | null;
    title: string | null;
    url: string;
  } | null;
  mediaDurationMs?: number | null;
  mediaId?: string | null;
  mediaMimeType?: string | null;
  mediaStoragePath?: string | null;
  mediaUrl?: string | null;
  messageType?: string;
  organizationId: string;
  recipientPhone: string;
  replyToMessageId?: string | null;
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
        media_id: params.mediaId ?? null,
        media_mime_type: params.mediaMimeType ?? null,
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

    if (data?.id && params.textBody) {
      const url = extractFirstUrl(params.textBody);
      if (url) {
        const linkPreview = await fetchLinkPreview(url);
        if (linkPreview) {
          await client
            .from('conversation_messages')
            .update({
              link_preview: {
                description: linkPreview.description,
                image_url: linkPreview.imageUrl,
                title: linkPreview.title,
                url: linkPreview.url,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', data.id);
        }
      }
    }

    if (conversation.contactId) {
      await this.maybePromoteColdToOpportunity(conversation.contactId);
    }

    return {
      conversationId: conversation.id,
      conversationMessageId: data?.id ?? null,
    };
  }

  async updateMessageMedia(params: {
    conversationMessageId: string;
    mediaId?: string | null;
    mediaMimeType: string;
    mediaStoragePath: string;
    mediaUrl: string;
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('conversation_messages')
      .update({
        media_id: params.mediaId ?? null,
        media_mime_type: params.mediaMimeType,
        media_storage_path: params.mediaStoragePath,
        media_url: params.mediaUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.conversationMessageId);

    if (error) {
      throw new Error(`Failed to update WhatsApp message media: ${error.message}`);
    }
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
      message_type: params.messageType ?? 'text',
      body: params.body,
      media_id: params.mediaId ?? null,
      media_mime_type: params.mediaMimeType ?? null,
      media_storage_path: params.mediaStoragePath ?? null,
      media_url: params.mediaUrl ?? null,
      media_duration_ms: params.mediaDurationMs ?? null,
      link_preview: params.linkPreview
        ? {
            description: params.linkPreview.description,
            image_url: params.linkPreview.imageUrl,
            title: params.linkPreview.title,
            url: params.linkPreview.url,
          }
        : null,
      reply_to_message_id: params.replyToMessageId ?? null,
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

    if (params.status === 'sent' && conversation.contactId) {
      await this.promoteNewToActive(conversation.contactId);
    }
  }

  async getMessageById(params: {
    businessCenterId: string;
    messageId: string;
    organizationId: string;
  }): Promise<{
    body: string | null;
    conversationId: string;
    direction: string;
    externalMessageId: string | null;
    id: string;
    mediaMimeType: string | null;
    mediaStoragePath: string | null;
    mediaUrl: string | null;
    messageType: string;
  } | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversation_messages')
      .select(
        'id, conversation_id, direction, external_message_id, body, message_type, media_url, media_storage_path, media_mime_type',
      )
      .eq('id', params.messageId)
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .maybeSingle<{
        body: string | null;
        conversation_id: string;
        direction: string;
        external_message_id: string | null;
        id: string;
        media_mime_type: string | null;
        media_storage_path: string | null;
        media_url: string | null;
        message_type: string;
      }>();

    if (error) {
      throw new Error(`Failed to load conversation message: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return {
      body: data.body,
      conversationId: data.conversation_id,
      direction: data.direction,
      externalMessageId: data.external_message_id,
      id: data.id,
      mediaMimeType: data.media_mime_type,
      mediaStoragePath: data.media_storage_path,
      mediaUrl: data.media_url,
      messageType: data.message_type,
    };
  }

  async markMessageEdited(params: {
    body: string;
    linkPreview?: {
      description: string | null;
      imageUrl: string | null;
      title: string | null;
      url: string;
    } | null;
    messageId: string;
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('conversation_messages')
      .update({
        body: params.body,
        edited_at: new Date().toISOString(),
        link_preview: params.linkPreview
          ? {
              description: params.linkPreview.description,
              image_url: params.linkPreview.imageUrl,
              title: params.linkPreview.title,
              url: params.linkPreview.url,
            }
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.messageId);

    if (error) {
      throw new Error(`Failed to mark message edited: ${error.message}`);
    }
  }

  private async promoteNewToActive(contactId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('contacts')
      .update({
        lead_status: 'active',
        lead_status_changed_at: new Date().toISOString(),
        cold_at: null,
      })
      .eq('id', contactId)
      .eq('lead_status', 'new');

    if (error) {
      throw new Error(`Failed to promote lead to active: ${error.message}`);
    }
  }

  private async maybePromoteColdToOpportunity(contactId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('contacts')
      .select('id, lead_status, cold_at')
      .eq('id', contactId)
      .maybeSingle<{ id: string; lead_status: string | null; cold_at: string | null }>();

    if (error) {
      throw new Error(`Failed to load contact for opportunity promotion: ${error.message}`);
    }
    if (!data || data.lead_status !== 'cold' || !data.cold_at) {
      return;
    }

    const coldMs = Date.now() - new Date(data.cold_at).getTime();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (coldMs <= oneYearMs) {
      return;
    }

    const { error: updateError } = await client
      .from('contacts')
      .update({
        lead_status: 'opportunity',
        lead_status_changed_at: new Date().toISOString(),
        cold_at: null,
      })
      .eq('id', contactId)
      .eq('lead_status', 'cold');

    if (updateError) {
      throw new Error(`Failed to promote cold lead to opportunity: ${updateError.message}`);
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

    return { contactId: contact.id, id: data.id };
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
      .select('id, lead_status, cold_at')
      .single<ContactRecord>();

    if (error) {
      throw new Error(`Failed to upsert WhatsApp contact: ${error.message}`);
    }

    return data;
  }
}
