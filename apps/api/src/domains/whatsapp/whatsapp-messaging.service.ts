import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { WhatsAppConversationMessageRepository } from './whatsapp-conversation-message.repository';
import {
  WhatsAppOutboundMessageService,
  type SendWhatsAppTextMessageResult,
} from './whatsapp-outbound-message.service';

interface ConversationRecord {
  business_center_id: string;
  external_contact_id: string;
  organization_id: string;
}

interface MembershipRow {
  role: 'owner' | 'staff';
}

export interface SendConversationTextMessageParams {
  authorizationHeader: string | undefined;
  body: string;
  businessCenterId: string;
  conversationId: string;
  organizationId: string;
}

export interface SendConversationImageMessageParams {
  authorizationHeader: string | undefined;
  body?: string | null;
  businessCenterId: string;
  conversationId: string;
  imageBase64: string;
  mimeType?: string | null;
  organizationId: string;
}

export interface SendConversationAudioMessageParams {
  audioBase64: string;
  authorizationHeader: string | undefined;
  businessCenterId: string;
  conversationId: string;
  durationMs?: number | null;
  mimeType?: string | null;
  organizationId: string;
}

export interface EditConversationMessageParams {
  authorizationHeader: string | undefined;
  body: string;
  businessCenterId: string;
  messageId: string;
  organizationId: string;
}

export interface ReactToConversationMessageParams {
  authorizationHeader: string | undefined;
  businessCenterId: string;
  emoji: string;
  messageId: string;
  organizationId: string;
}

export interface ForwardConversationMessageParams {
  authorizationHeader: string | undefined;
  businessCenterId: string;
  messageId: string;
  organizationId: string;
  targetConversationId: string;
}

@Injectable()
export class WhatsAppMessagingService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly outboundMessageService: WhatsAppOutboundMessageService,
    private readonly messageRepository: WhatsAppConversationMessageRepository,
  ) {}

  async sendConversationTextMessage(
    params: SendConversationTextMessageParams,
  ): Promise<SendWhatsAppTextMessageResult> {
    const body = params.body.trim();

    if (!body) {
      throw new Error('body is required');
    }

    await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    const conversation = await this.getConversation({
      businessCenterId: params.businessCenterId,
      conversationId: params.conversationId,
      organizationId: params.organizationId,
    });

    return this.outboundMessageService.sendTextMessage({
      body,
      businessCenterId: conversation.business_center_id,
      organizationId: conversation.organization_id,
      recipientPhone: conversation.external_contact_id,
    });
  }

  async sendConversationImageMessage(
    params: SendConversationImageMessageParams,
  ): Promise<SendWhatsAppTextMessageResult> {
    if (!params.imageBase64?.trim()) {
      throw new Error('imageBase64 is required');
    }

    await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    const conversation = await this.getConversation({
      businessCenterId: params.businessCenterId,
      conversationId: params.conversationId,
      organizationId: params.organizationId,
    });

    return this.outboundMessageService.sendImageMessage({
      body: params.body,
      businessCenterId: conversation.business_center_id,
      conversationId: params.conversationId,
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      organizationId: conversation.organization_id,
      recipientPhone: conversation.external_contact_id,
    });
  }

  async sendConversationAudioMessage(
    params: SendConversationAudioMessageParams,
  ): Promise<SendWhatsAppTextMessageResult> {
    if (!params.audioBase64?.trim()) {
      throw new Error('audioBase64 is required');
    }

    await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    const conversation = await this.getConversation({
      businessCenterId: params.businessCenterId,
      conversationId: params.conversationId,
      organizationId: params.organizationId,
    });

    return this.outboundMessageService.sendAudioMessage({
      audioBase64: params.audioBase64,
      businessCenterId: conversation.business_center_id,
      conversationId: params.conversationId,
      durationMs: params.durationMs,
      mimeType: params.mimeType,
      organizationId: conversation.organization_id,
      recipientPhone: conversation.external_contact_id,
    });
  }

  async editConversationMessage(
    params: EditConversationMessageParams,
  ): Promise<{ status: 'edited' }> {
    await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    return this.outboundMessageService.editTextMessage({
      body: params.body,
      businessCenterId: params.businessCenterId,
      messageId: params.messageId,
      organizationId: params.organizationId,
    });
  }

  async reactToConversationMessage(
    params: ReactToConversationMessageParams,
  ): Promise<{ status: 'reacted' }> {
    await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    const message = await this.messageRepository.getMessageById({
      businessCenterId: params.businessCenterId,
      messageId: params.messageId,
      organizationId: params.organizationId,
    });
    if (!message) {
      throw new Error('Message not found');
    }

    const conversation = await this.getConversation({
      businessCenterId: params.businessCenterId,
      conversationId: message.conversationId,
      organizationId: params.organizationId,
    });

    return this.outboundMessageService.reactToMessage({
      businessCenterId: params.businessCenterId,
      emoji: params.emoji,
      messageId: params.messageId,
      organizationId: params.organizationId,
      recipientPhone: conversation.external_contact_id,
    });
  }

  async forwardConversationMessage(
    params: ForwardConversationMessageParams,
  ): Promise<SendWhatsAppTextMessageResult> {
    await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    const message = await this.messageRepository.getMessageById({
      businessCenterId: params.businessCenterId,
      messageId: params.messageId,
      organizationId: params.organizationId,
    });
    if (!message) {
      throw new Error('Message not found');
    }

    const target = await this.getConversation({
      businessCenterId: params.businessCenterId,
      conversationId: params.targetConversationId,
      organizationId: params.organizationId,
    });

    if (message.messageType === 'audio' && message.mediaUrl) {
      const audioResponse = await fetch(message.mediaUrl);
      if (!audioResponse.ok) {
        throw new Error('No se pudo leer el audio a reenviar');
      }
      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      return this.outboundMessageService.sendAudioMessage({
        audioBase64: buffer.toString('base64'),
        businessCenterId: target.business_center_id,
        conversationId: params.targetConversationId,
        mimeType: message.mediaMimeType,
        organizationId: target.organization_id,
        recipientPhone: target.external_contact_id,
      });
    }

    if (message.messageType === 'image' && message.mediaUrl) {
      const imageResponse = await fetch(message.mediaUrl);
      if (!imageResponse.ok) {
        throw new Error('No se pudo leer la imagen a reenviar');
      }
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      return this.outboundMessageService.sendImageMessage({
        body: message.body,
        businessCenterId: target.business_center_id,
        conversationId: params.targetConversationId,
        imageBase64: buffer.toString('base64'),
        mimeType: message.mediaMimeType,
        organizationId: target.organization_id,
        recipientPhone: target.external_contact_id,
      });
    }

    const body = (message.body ?? '').trim();
    if (!body) {
      throw new Error('No hay contenido para reenviar');
    }

    return this.outboundMessageService.sendTextMessage({
      body,
      businessCenterId: target.business_center_id,
      organizationId: target.organization_id,
      recipientPhone: target.external_contact_id,
    });
  }

  private async getConversation(params: {
    businessCenterId: string;
    conversationId: string;
    organizationId: string;
  }): Promise<ConversationRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversations')
      .select('organization_id, business_center_id, external_contact_id')
      .eq('id', params.conversationId)
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .single<ConversationRecord>();

    if (error || !data?.external_contact_id) {
      throw new Error('Conversation not found');
    }

    return data;
  }

  private async assertMember(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<void> {
    const token = params.authorizationHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      throw new Error('Missing bearer token');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);

    if (userError || !userData.user) {
      throw new Error('Invalid bearer token');
    }

    const { data, error } = await client
      .from('organization_members')
      .select('role')
      .eq('organization_id', params.organizationId)
      .eq('user_id', userData.user.id)
      .single<MembershipRow>();

    if (error || !data) {
      throw new Error('User is not a member of this organization');
    }
  }
}
