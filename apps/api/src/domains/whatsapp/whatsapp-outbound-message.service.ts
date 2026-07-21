import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { WhatsAppConversationMessageRepository } from './whatsapp-conversation-message.repository';

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

@Injectable()
export class WhatsAppOutboundMessageService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly messageRepository: WhatsAppConversationMessageRepository,
  ) {}

  async sendTextMessage(
    params: SendWhatsAppTextMessageParams,
  ): Promise<SendWhatsAppTextMessageResult> {
    const config = await this.getConnectedConfig({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });
    const sentAt = new Date().toISOString();

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resolveAccessToken(config)}`,
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

    await this.messageRepository.recordOutboundMessage({
      body: params.body,
      businessCenterId: config.business_center_id,
      externalMessageId: externalMessageId ?? undefined,
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

  private async getConnectedConfig(params: {
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

  /** Prefer shared env token; legacy DB field is plaintext fallback until KMS. */
  private resolveAccessToken(config: WhatsAppConfigRecord): string {
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
