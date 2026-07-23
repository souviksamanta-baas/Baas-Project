import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  assertOrgMembership,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { decryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { InstagramMessagingWindowState } from './instagram-connection.types';

@Injectable()
export class InstagramMessagingService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getMessagingState(params: {
    authorizationHeader: string | undefined;
    conversationId: string;
    organizationId: string;
  }): Promise<{
    expiresAt: string | null;
    lastInboundAt: string | null;
    state: InstagramMessagingWindowState;
  }> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data: conversation, error } = await client
      .from('conversations')
      .select('id, channel, last_inbound_at, messaging_window_expires_at')
      .eq('id', params.conversationId)
      .eq('organization_id', params.organizationId)
      .maybeSingle<{
        channel: string;
        id: string;
        last_inbound_at: string | null;
        messaging_window_expires_at: string | null;
      }>();

    if (error || !conversation || conversation.channel !== 'instagram') {
      throw new BadRequestException('Conversación de Instagram no encontrada.');
    }

    return {
      expiresAt: conversation.messaging_window_expires_at,
      lastInboundAt: conversation.last_inbound_at,
      state: this.computeWindowState(conversation),
    };
  }

  async sendText(params: {
    authorizationHeader: string | undefined;
    body: string;
    businessCenterId: string;
    conversationId: string;
    organizationId: string;
  }): Promise<{ externalMessageId: string | null; status: 'sent' }> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data: conversation, error: conversationError } = await client
      .from('conversations')
      .select(
        'id, external_contact_id, channel, last_inbound_at, messaging_window_expires_at, instagram_config_id',
      )
      .eq('id', params.conversationId)
      .eq('organization_id', params.organizationId)
      .maybeSingle<{
        channel: string;
        external_contact_id: string;
        id: string;
        instagram_config_id: string | null;
        last_inbound_at: string | null;
        messaging_window_expires_at: string | null;
      }>();

    if (conversationError || !conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.channel !== 'instagram') {
      throw new Error('Conversation is not an Instagram thread');
    }

    const windowState = this.computeWindowState(conversation);
    if (windowState !== 'reply_available') {
      throw new BadRequestException(this.windowErrorMessage(windowState));
    }

    const { data: config, error: configError } = await client
      .from('instagram_config')
      .select('id, ig_user_id, access_token_encrypted, connection_status, token_status')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .maybeSingle<{
        access_token_encrypted: string | null;
        connection_status: string;
        id: string;
        ig_user_id: string;
        token_status: string;
      }>();

    if (configError || !config || config.connection_status !== 'connected') {
      throw new BadRequestException('Instagram no está conectado para este negocio.');
    }

    if (config.token_status === 'revoked' || config.token_status === 'expired') {
      throw new BadRequestException('El token de Instagram expiró. Volvé a conectar la cuenta.');
    }

    let accessToken: string;
    try {
      accessToken = decryptSecret(
        config.access_token_encrypted ?? '',
        this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY'),
      );
    } catch {
      throw new BadRequestException('No se pudo leer el token de Instagram.');
    }

    const response = await fetch(
      `https://graph.instagram.com/v21.0/${config.ig_user_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: conversation.external_contact_id },
          message: { text: params.body },
        }),
      },
    );

    const payload = (await response.json()) as {
      message_id?: string;
      error?: { code?: number; message?: string };
    };

    if (!response.ok) {
      if (payload.error?.code === 10 || /permission|advanced/i.test(payload.error?.message ?? '')) {
        throw new BadRequestException(
          'Meta requiere Advanced Access para mensajería. Revisá el estado de la app.',
        );
      }
      throw new Error(payload.error?.message ?? `Instagram send failed (${response.status})`);
    }

    const sentAt = new Date().toISOString();
    await client.from('conversation_messages').insert({
      organization_id: params.organizationId,
      business_center_id: params.businessCenterId,
      conversation_id: params.conversationId,
      direction: 'outbound',
      external_message_id: payload.message_id ?? null,
      recipient_phone: conversation.external_contact_id,
      message_type: 'text',
      body: params.body,
      message_status: 'sent',
      sent_at: sentAt,
      metadata: { source: 'instagram_messaging_api', senderType: 'USER' },
    });

    await client
      .from('conversations')
      .update({ last_message_at: sentAt, updated_at: sentAt })
      .eq('id', params.conversationId);

    return { externalMessageId: payload.message_id ?? null, status: 'sent' };
  }

  computeWindowState(conversation: {
    last_inbound_at: string | null;
    messaging_window_expires_at: string | null;
  }): InstagramMessagingWindowState {
    if (!conversation.last_inbound_at) {
      return 'customer_must_message_first';
    }

    const expiresAt = conversation.messaging_window_expires_at
      ? new Date(conversation.messaging_window_expires_at).getTime()
      : new Date(conversation.last_inbound_at).getTime() + 24 * 60 * 60 * 1000;

    if (Date.now() <= expiresAt) {
      return 'reply_available';
    }

    return 'window_expired';
  }

  private windowErrorMessage(state: InstagramMessagingWindowState): string {
    switch (state) {
      case 'customer_must_message_first':
        return 'El cliente tiene que escribir primero por Instagram.';
      case 'window_expired':
        return 'La ventana de 24 horas expiró. Esperá un nuevo mensaje del cliente.';
      case 'human_reply_only':
        return 'Solo un agente humano puede responder en esta ventana.';
      case 'meta_approval_required':
        return 'Meta aún no aprobó Advanced Access para esta app.';
      default:
        return 'No se puede enviar el mensaje ahora.';
    }
  }
}
