import { Injectable, Logger, Optional } from '@nestjs/common';

import { SalesAiService } from '../../domains/ai/sales-ai.service';
import { WhatsAppConversationMessageRepository } from '../../domains/whatsapp/whatsapp-conversation-message.repository';
import { WhatsAppMediaService } from '../../domains/whatsapp/whatsapp-media.service';
import { WhatsAppOutboundMessageService } from '../../domains/whatsapp/whatsapp-outbound-message.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { WhatsAppInboundMessageLog } from './whatsapp-webhook.types';

interface WhatsAppConfigRecord {
  business_center_id: string;
  id: string;
  organization_id: string;
  phone_number_id: string;
}

interface WhatsAppMessageEventRecord {
  business_center_id: string | null;
  id: string;
  organization_id: string | null;
  whatsapp_config_id: string | null;
}

interface PersistedWhatsAppEventRow {
  organization_id: string | null;
  whatsapp_config_id: string | null;
  phone_number_id: string;
  message_id: string;
  sender_phone: string;
  message_type: string;
  message_timestamp: string | null;
  processing_status: 'received';
  payload_metadata: Record<string, string | null>;
  business_center_id: string | null;
}

const WEBHOOK_EVENT_CONCURRENCY = 5;

@Injectable()
export class WhatsAppMessageEventRepository {
  private readonly logger = new Logger(WhatsAppMessageEventRepository.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional()
    private readonly messageRepository?: WhatsAppConversationMessageRepository,
    @Optional()
    private readonly salesAiService?: SalesAiService,
    @Optional()
    private readonly mediaService?: WhatsAppMediaService,
    @Optional()
    private readonly outboundMessageService?: WhatsAppOutboundMessageService,
  ) {}

  async recordInboundMessages(
    events: WhatsAppInboundMessageLog[],
  ): Promise<WhatsAppInboundMessageLog[]> {
    if (events.length === 0) {
      return events;
    }

    if (!this.supabaseService.hasServiceRoleConfig()) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Cannot persist WhatsApp webhook events without Supabase service-role configuration');
      }

      return events;
    }

    const whatsappConfigs = await this.findWhatsAppConfigs(events.map((event) => event.phoneNumberId));

    return mapWithConcurrency(events, WEBHOOK_EVENT_CONCURRENCY, (event) =>
      this.recordInboundMessage(event, whatsappConfigs.get(event.phoneNumberId) ?? null),
    );
  }

  private async recordInboundMessage(
    event: WhatsAppInboundMessageLog,
    whatsappConfig: WhatsAppConfigRecord | null,
  ): Promise<WhatsAppInboundMessageLog> {
    const client = this.supabaseService.getServiceRoleClient();
    const row = this.toInsertRow(event, whatsappConfig);
    const { data, error } = await client
      .from('whatsapp_message_events')
      .insert(row)
      .select('id, organization_id, business_center_id, whatsapp_config_id')
      .single<WhatsAppMessageEventRecord>();

    if (!error) {
      await this.recordConversationMessage(event, data);
      return { ...event, duplicate: false };
    }

    if (error.code === '23505') {
      await client
        .from('whatsapp_message_events')
        .update({
          last_received_at: new Date().toISOString(),
          processing_status: 'duplicate',
        })
        .eq('phone_number_id', event.phoneNumberId)
        .eq('message_id', event.messageId);

      return { ...event, duplicate: true };
    }

    throw new Error(`Failed to persist WhatsApp webhook event: ${error.message}`);
  }

  private async findWhatsAppConfigs(phoneNumberIds: string[]): Promise<Map<string, WhatsAppConfigRecord>> {
    const uniquePhoneNumberIds = [...new Set(phoneNumberIds)];
    if (uniquePhoneNumberIds.length === 0) {
      return new Map();
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('whatsapp_config')
      .select('id, organization_id, business_center_id, phone_number_id')
      .in('phone_number_id', uniquePhoneNumberIds);

    if (error) {
      throw new Error(`Failed to resolve WhatsApp configs: ${error.message}`);
    }

    return new Map((data as WhatsAppConfigRecord[]).map((config) => [config.phone_number_id, config]));
  }

  private toInsertRow(
    event: WhatsAppInboundMessageLog,
    whatsappConfig: WhatsAppConfigRecord | null,
  ): PersistedWhatsAppEventRow {
    return {
      organization_id: whatsappConfig?.organization_id ?? null,
      business_center_id: whatsappConfig?.business_center_id ?? null,
      whatsapp_config_id: whatsappConfig?.id ?? null,
      phone_number_id: event.phoneNumberId,
      message_id: event.messageId,
      sender_phone: event.senderPhone,
      message_type: event.messageType,
      message_timestamp: event.timestamp,
      processing_status: 'received',
      payload_metadata: {
        source: 'whatsapp_cloud_api',
        media_id: event.mediaId,
        media_mime_type: event.mediaMimeType,
      },
    };
  }

  private async recordConversationMessage(
    event: WhatsAppInboundMessageLog,
    messageEvent: WhatsAppMessageEventRecord,
  ): Promise<void> {
    if (
      !this.messageRepository ||
      !messageEvent.organization_id ||
      !messageEvent.business_center_id ||
      !messageEvent.whatsapp_config_id
    ) {
      return;
    }

    const persistedMessage = await this.messageRepository.recordInboundMessage({
      businessCenterId: messageEvent.business_center_id,
      eventId: messageEvent.id,
      mediaId: event.mediaId,
      mediaMimeType: event.mediaMimeType,
      organizationId: messageEvent.organization_id,
      whatsappConfigId: messageEvent.whatsapp_config_id,
      messageId: event.messageId,
      senderDisplayName: event.senderDisplayName,
      senderPhone: event.senderPhone,
      textBody: event.textBody,
      timestamp: event.timestamp,
      messageType: event.messageType,
    });

    if (
      persistedMessage.conversationMessageId &&
      event.mediaId &&
      event.messageType === 'image'
    ) {
      void this.hydrateInboundImage({
        businessCenterId: messageEvent.business_center_id,
        conversationId: persistedMessage.conversationId,
        conversationMessageId: persistedMessage.conversationMessageId,
        mediaId: event.mediaId,
        mediaMimeType: event.mediaMimeType,
        organizationId: messageEvent.organization_id,
        phoneNumberId: event.phoneNumberId,
      }).catch((error: unknown) => {
        this.logger.error(
          JSON.stringify({
            event: 'whatsapp.media.inbound_hydrate.failed',
            message: error instanceof Error ? error.message : 'Unknown media hydrate error',
            mediaId: event.mediaId,
            conversationMessageId: persistedMessage.conversationMessageId,
          }),
        );
      });
    }

    if (persistedMessage.conversationMessageId) {
      void this.salesAiService
        ?.handleInboundMessage({
          conversationId: persistedMessage.conversationId,
          businessCenterId: messageEvent.business_center_id,
          organizationId: messageEvent.organization_id,
          sourceMessageId: persistedMessage.conversationMessageId,
          textBody: event.textBody,
        })
        .catch((error: unknown) => {
          this.logger.error(
            JSON.stringify({
              event: 'sales_ai.draft_generation.failed',
              message: error instanceof Error ? error.message : 'Unknown AI draft error',
              sourceMessageId: persistedMessage.conversationMessageId,
            }),
          );
        });
    }
  }

  private async hydrateInboundImage(params: {
    businessCenterId: string;
    conversationId: string;
    conversationMessageId: string;
    mediaId: string;
    mediaMimeType: string | null;
    organizationId: string;
    phoneNumberId: string;
  }): Promise<void> {
    if (!this.mediaService || !this.messageRepository || !this.outboundMessageService) {
      return;
    }

    const config = await this.outboundMessageService.getConnectedConfigByPhoneNumberId(
      params.phoneNumberId,
    );
    if (!config) {
      throw new Error('Connected WhatsApp configuration is required to download media');
    }

    const accessToken = this.outboundMessageService.resolveAccessTokenForConfig(config);
    const downloaded = await this.mediaService.downloadFromMeta({
      accessToken,
      mediaId: params.mediaId,
    });
    const stored = await this.mediaService.storeMedia({
      buffer: downloaded.buffer,
      businessCenterId: params.businessCenterId,
      conversationId: params.conversationId,
      messageId: params.conversationMessageId,
      mimeType: downloaded.mimeType || params.mediaMimeType || 'image/jpeg',
      organizationId: params.organizationId,
    });

    await this.messageRepository.updateMessageMedia({
      conversationMessageId: params.conversationMessageId,
      mediaId: params.mediaId,
      mediaMimeType: stored.mediaMimeType,
      mediaStoragePath: stored.mediaStoragePath,
      mediaUrl: stored.mediaUrl,
    });
  }
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
