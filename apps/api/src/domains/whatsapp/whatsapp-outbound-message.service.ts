import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { WhatsAppConversationMessageRepository } from './whatsapp-conversation-message.repository';
import { extractFirstUrl, fetchLinkPreview } from './whatsapp-link-preview.util';
import { WhatsAppMediaService } from './whatsapp-media.service';

interface WhatsAppConfigRecord {
  business_center_id: string;
  id: string;
  organization_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  access_token_encrypted: string | null;
  connection_status: 'pending' | 'connected' | 'error' | 'disabled';
}

interface WhatsAppSendResponse {
  messages?: Array<{
    id?: string;
  }>;
  error?: {
    message?: string;
  };
}

export interface SendWhatsAppTextMessageParams {
  body: string;
  businessCenterId: string;
  organizationId: string;
  recipientPhone: string;
}

export interface SendWhatsAppTextMessageResult {
  externalMessageId: string | null;
  status: 'sent';
}

export interface SendWhatsAppImageMessageParams {
  body?: string | null;
  businessCenterId: string;
  conversationId: string;
  imageBase64: string;
  mimeType?: string | null;
  organizationId: string;
  recipientPhone: string;
}

export interface SendWhatsAppAudioMessageParams {
  audioBase64: string;
  businessCenterId: string;
  conversationId: string;
  durationMs?: number | null;
  mimeType?: string | null;
  organizationId: string;
  recipientPhone: string;
}

export interface EditWhatsAppMessageParams {
  body: string;
  businessCenterId: string;
  messageId: string;
  organizationId: string;
}

export interface ReactWhatsAppMessageParams {
  businessCenterId: string;
  emoji: string;
  messageId: string;
  organizationId: string;
  recipientPhone: string;
}

@Injectable()
export class WhatsAppOutboundMessageService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly messageRepository: WhatsAppConversationMessageRepository,
    private readonly mediaService: WhatsAppMediaService,
  ) {}

  async sendTextMessage(
    params: SendWhatsAppTextMessageParams,
  ): Promise<SendWhatsAppTextMessageResult> {
    const config = await this.getConnectedConfig({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });
    const sentAt = new Date().toISOString();
    const accessToken = this.resolveAccessToken(config);

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.recipientPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: params.body,
          },
        }),
      },
    );

    const responseBody = await this.parseSendResponse(response);
    const externalMessageId = responseBody.messages?.[0]?.id ?? null;

    if (!response.ok) {
      const errorMessage =
        responseBody.error?.message ?? `WhatsApp send failed with HTTP ${response.status}`;

      await this.messageRepository.recordOutboundMessage({
        body: params.body,
        businessCenterId: config.business_center_id,
        errorMessage,
        organizationId: params.organizationId,
        recipientPhone: params.recipientPhone,
        senderPhone: config.display_phone_number,
        sentAt,
        status: 'failed',
        whatsappConfigId: config.id,
      });

      throw new Error(errorMessage);
    }

    const url = extractFirstUrl(params.body);
    const linkPreview = url ? await fetchLinkPreview(url) : null;

    await this.messageRepository.recordOutboundMessage({
      body: params.body,
      businessCenterId: config.business_center_id,
      externalMessageId: externalMessageId ?? undefined,
      linkPreview,
      organizationId: params.organizationId,
      recipientPhone: params.recipientPhone,
      senderPhone: config.display_phone_number,
      sentAt,
      status: 'sent',
      whatsappConfigId: config.id,
    });

    return {
      externalMessageId,
      status: 'sent',
    };
  }

  async sendImageMessage(
    params: SendWhatsAppImageMessageParams,
  ): Promise<SendWhatsAppTextMessageResult> {
    const config = await this.getConnectedConfig({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });
    const accessToken = this.resolveAccessToken(config);
    const caption = params.body?.trim() || null;
    const decoded = this.mediaService.decodeBase64Image({
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
    });
    const sentAt = new Date().toISOString();
    const localMessageId = `outbound-${Date.now()}`;

    const stored = await this.mediaService.storeMedia({
      buffer: decoded.buffer,
      businessCenterId: config.business_center_id,
      conversationId: params.conversationId,
      messageId: localMessageId,
      mimeType: decoded.mimeType,
      organizationId: params.organizationId,
    });

    let metaMediaId: string;
    try {
      metaMediaId = await this.mediaService.uploadToMeta({
        accessToken,
        buffer: decoded.buffer,
        mimeType: decoded.mimeType,
        phoneNumberId: config.phone_number_id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'WhatsApp media upload failed';
      await this.messageRepository.recordOutboundMessage({
        body: caption,
        businessCenterId: config.business_center_id,
        errorMessage,
        mediaMimeType: stored.mediaMimeType,
        mediaStoragePath: stored.mediaStoragePath,
        mediaUrl: stored.mediaUrl,
        messageType: 'image',
        organizationId: params.organizationId,
        recipientPhone: params.recipientPhone,
        senderPhone: config.display_phone_number,
        sentAt,
        status: 'failed',
        whatsappConfigId: config.id,
      });
      throw error instanceof Error ? error : new Error(errorMessage);
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.recipientPhone,
          type: 'image',
          image: {
            id: metaMediaId,
            ...(caption ? { caption } : {}),
          },
        }),
      },
    );

    const responseBody = await this.parseSendResponse(response);
    const externalMessageId = responseBody.messages?.[0]?.id ?? null;

    if (!response.ok) {
      const errorMessage =
        responseBody.error?.message ?? `WhatsApp send failed with HTTP ${response.status}`;

      await this.messageRepository.recordOutboundMessage({
        body: caption,
        businessCenterId: config.business_center_id,
        errorMessage,
        mediaId: metaMediaId,
        mediaMimeType: stored.mediaMimeType,
        mediaStoragePath: stored.mediaStoragePath,
        mediaUrl: stored.mediaUrl,
        messageType: 'image',
        organizationId: params.organizationId,
        recipientPhone: params.recipientPhone,
        senderPhone: config.display_phone_number,
        sentAt,
        status: 'failed',
        whatsappConfigId: config.id,
      });

      throw new Error(errorMessage);
    }

    await this.messageRepository.recordOutboundMessage({
      body: caption,
      businessCenterId: config.business_center_id,
      externalMessageId: externalMessageId ?? undefined,
      mediaId: metaMediaId,
      mediaMimeType: stored.mediaMimeType,
      mediaStoragePath: stored.mediaStoragePath,
      mediaUrl: stored.mediaUrl,
      messageType: 'image',
      organizationId: params.organizationId,
      recipientPhone: params.recipientPhone,
      senderPhone: config.display_phone_number,
      sentAt,
      status: 'sent',
      whatsappConfigId: config.id,
    });

    return {
      externalMessageId,
      status: 'sent',
    };
  }

  async sendAudioMessage(
    params: SendWhatsAppAudioMessageParams,
  ): Promise<SendWhatsAppTextMessageResult> {
    const config = await this.getConnectedConfig({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });
    const accessToken = this.resolveAccessToken(config);
    const decoded = this.mediaService.decodeBase64Audio({
      audioBase64: params.audioBase64,
      mimeType: params.mimeType,
    });
    const sentAt = new Date().toISOString();
    const localMessageId = `outbound-audio-${Date.now()}`;

    const stored = await this.mediaService.storeMedia({
      buffer: decoded.buffer,
      businessCenterId: config.business_center_id,
      conversationId: params.conversationId,
      messageId: localMessageId,
      mimeType: decoded.mimeType,
      organizationId: params.organizationId,
    });

    let metaMediaId: string;
    try {
      metaMediaId = await this.mediaService.uploadToMeta({
        accessToken,
        buffer: decoded.buffer,
        filename: `audio.${this.mediaService.extensionForMime(decoded.mimeType)}`,
        mimeType: decoded.mimeType,
        phoneNumberId: config.phone_number_id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'WhatsApp audio upload failed';
      await this.messageRepository.recordOutboundMessage({
        body: null,
        businessCenterId: config.business_center_id,
        errorMessage,
        mediaDurationMs: params.durationMs ?? null,
        mediaMimeType: stored.mediaMimeType,
        mediaStoragePath: stored.mediaStoragePath,
        mediaUrl: stored.mediaUrl,
        messageType: 'audio',
        organizationId: params.organizationId,
        recipientPhone: params.recipientPhone,
        senderPhone: config.display_phone_number,
        sentAt,
        status: 'failed',
        whatsappConfigId: config.id,
      });
      throw error instanceof Error ? error : new Error(errorMessage);
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.recipientPhone,
          type: 'audio',
          audio: {
            id: metaMediaId,
          },
        }),
      },
    );

    const responseBody = await this.parseSendResponse(response);
    const externalMessageId = responseBody.messages?.[0]?.id ?? null;

    if (!response.ok) {
      const errorMessage =
        responseBody.error?.message ?? `WhatsApp audio send failed with HTTP ${response.status}`;

      await this.messageRepository.recordOutboundMessage({
        body: null,
        businessCenterId: config.business_center_id,
        errorMessage,
        mediaDurationMs: params.durationMs ?? null,
        mediaId: metaMediaId,
        mediaMimeType: stored.mediaMimeType,
        mediaStoragePath: stored.mediaStoragePath,
        mediaUrl: stored.mediaUrl,
        messageType: 'audio',
        organizationId: params.organizationId,
        recipientPhone: params.recipientPhone,
        senderPhone: config.display_phone_number,
        sentAt,
        status: 'failed',
        whatsappConfigId: config.id,
      });

      throw new Error(errorMessage);
    }

    await this.messageRepository.recordOutboundMessage({
      body: null,
      businessCenterId: config.business_center_id,
      externalMessageId: externalMessageId ?? undefined,
      mediaDurationMs: params.durationMs ?? null,
      mediaId: metaMediaId,
      mediaMimeType: stored.mediaMimeType,
      mediaStoragePath: stored.mediaStoragePath,
      mediaUrl: stored.mediaUrl,
      messageType: 'audio',
      organizationId: params.organizationId,
      recipientPhone: params.recipientPhone,
      senderPhone: config.display_phone_number,
      sentAt,
      status: 'sent',
      whatsappConfigId: config.id,
    });

    return {
      externalMessageId,
      status: 'sent',
    };
  }

  async editTextMessage(params: EditWhatsAppMessageParams): Promise<{ status: 'edited' }> {
    const body = params.body.trim();
    if (!body) {
      throw new Error('body is required');
    }

    const message = await this.messageRepository.getMessageById({
      businessCenterId: params.businessCenterId,
      messageId: params.messageId,
      organizationId: params.organizationId,
    });
    if (!message?.externalMessageId) {
      throw new Error('Message not found or missing WhatsApp id');
    }
    if (message.direction !== 'outbound' || message.messageType !== 'text') {
      throw new Error('Only outbound text messages can be edited');
    }

    const config = await this.getConnectedConfig({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });
    const accessToken = this.resolveAccessToken(config);

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          message_id: message.externalMessageId,
          type: 'edit',
          edit: {
            type: 'text',
            text: {
              body,
            },
          },
        }),
      },
    );

    const responseBody = await this.parseSendResponse(response);
    if (!response.ok) {
      throw new Error(
        responseBody.error?.message ?? `WhatsApp edit failed with HTTP ${response.status}`,
      );
    }

    const url = extractFirstUrl(body);
    const linkPreview = url ? await fetchLinkPreview(url) : null;
    await this.messageRepository.markMessageEdited({
      body,
      linkPreview,
      messageId: message.id,
    });

    return { status: 'edited' };
  }

  async reactToMessage(params: ReactWhatsAppMessageParams): Promise<{ status: 'reacted' }> {
    const emoji = params.emoji.trim();
    if (!emoji) {
      throw new Error('emoji is required');
    }

    const message = await this.messageRepository.getMessageById({
      businessCenterId: params.businessCenterId,
      messageId: params.messageId,
      organizationId: params.organizationId,
    });
    if (!message?.externalMessageId) {
      throw new Error('Message not found or missing WhatsApp id');
    }

    const config = await this.getConnectedConfig({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });
    const accessToken = this.resolveAccessToken(config);

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.recipientPhone,
          type: 'reaction',
          reaction: {
            message_id: message.externalMessageId,
            emoji,
          },
        }),
      },
    );

    const responseBody = await this.parseSendResponse(response);
    if (!response.ok) {
      throw new Error(
        responseBody.error?.message ?? `WhatsApp reaction failed with HTTP ${response.status}`,
      );
    }

    return { status: 'reacted' };
  }

  async getConnectedConfig(params: {
    businessCenterId: string;
    organizationId: string;
  }): Promise<WhatsAppConfigRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('whatsapp_config')
      .select(
        'id, organization_id, business_center_id, phone_number_id, display_phone_number, access_token_encrypted, connection_status',
      )
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('connection_status', 'connected')
      .maybeSingle<WhatsAppConfigRecord>();

    if (error) {
      throw new Error(`Failed to load WhatsApp send configuration: ${error.message}`);
    }

    if (!data) {
      throw new Error('Connected WhatsApp configuration is required to send messages');
    }

    const envToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
    if (!envToken && !data.access_token_encrypted) {
      throw new Error('WhatsApp access token is not configured (set WHATSAPP_CLOUD_ACCESS_TOKEN)');
    }

    return data;
  }

  async getConnectedConfigByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppConfigRecord | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('whatsapp_config')
      .select(
        'id, organization_id, business_center_id, phone_number_id, display_phone_number, access_token_encrypted, connection_status',
      )
      .eq('phone_number_id', phoneNumberId)
      .eq('connection_status', 'connected')
      .maybeSingle<WhatsAppConfigRecord>();

    if (error) {
      throw new Error(`Failed to load WhatsApp config by phone number: ${error.message}`);
    }

    return data;
  }

  resolveAccessTokenForConfig(config: { access_token_encrypted: string | null }): string {
    return this.resolveAccessToken(config);
  }

  /** Prefer shared env token; legacy DB field is plaintext fallback until KMS. */
  private resolveAccessToken(config: { access_token_encrypted: string | null }): string {
    const envToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
    if (envToken) {
      return envToken;
    }
    if (config.access_token_encrypted) {
      return config.access_token_encrypted;
    }
    throw new Error('WhatsApp access token is not configured (set WHATSAPP_CLOUD_ACCESS_TOKEN)');
  }

  private async parseSendResponse(response: Response): Promise<WhatsAppSendResponse> {
    try {
      return (await response.json()) as WhatsAppSendResponse;
    } catch {
      return {};
    }
  }
}
