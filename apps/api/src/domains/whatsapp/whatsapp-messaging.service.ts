import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
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

@Injectable()
export class WhatsAppMessagingService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly outboundMessageService: WhatsAppOutboundMessageService,
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
