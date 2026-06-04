import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { WhatsAppConversationMessageRepository } from './whatsapp-conversation-message.repository';

interface WhatsAppConfigRecord {
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
    const config = await this.getConnectedConfig(params.organizationId);
    const sentAt = new Date().toISOString();

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.access_token_encrypted}`,
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

  private async getConnectedConfig(organizationId: string): Promise<WhatsAppConfigRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('whatsapp_config')
      .select(
        'id, organization_id, phone_number_id, display_phone_number, access_token_encrypted, connection_status',
      )
      .eq('organization_id', organizationId)
      .eq('connection_status', 'connected')
      .maybeSingle<WhatsAppConfigRecord>();

    if (error) {
      throw new Error(`Failed to load WhatsApp send configuration: ${error.message}`);
    }

    if (!data?.access_token_encrypted) {
      throw new Error('Connected WhatsApp configuration with access token is required to send messages');
    }

    return data;
  }

  private async parseSendResponse(response: Response): Promise<WhatsAppSendResponse> {
    try {
      return (await response.json()) as WhatsAppSendResponse;
    } catch {
      return {};
    }
  }
}
