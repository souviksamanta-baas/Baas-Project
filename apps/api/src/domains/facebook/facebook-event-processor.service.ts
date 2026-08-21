import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { decryptSecret } from '../../lib/token-crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../../supabase/supabase.service';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const GRAPH_API_VERSION = 'v20.0';

export interface FacebookInboundEnvelope {
  mid: string;
  senderId: string;
  recipientId: string;
  text: string | null;
  timestampMs: number;
  raw: unknown;
  kind: 'message' | 'seen' | 'delivery' | 'postback' | 'referral' | 'other';
}

@Injectable()
export class FacebookEventProcessor {
  private readonly logger = new Logger(FacebookEventProcessor.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  scheduleProcess(eventIds: string[]): void {
    setImmediate(() => {
      void this.processEventIds(eventIds).catch((error: unknown) => {
        this.logger.error(
          error instanceof Error ? error.message : 'Facebook event processing failed',
        );
      });
    });
  }

  async processEventIds(eventIds: string[]): Promise<void> {
    for (const eventId of eventIds) {
      await this.processOne(eventId);
    }
  }

  private async processOne(eventId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data: event, error } = await client
      .from('facebook_message_events')
      .select(
        'id, organization_id, business_center_id, facebook_config_id, page_id, external_event_id, payload, processing_status',
      )
      .eq('id', eventId)
      .maybeSingle<{
        business_center_id: string | null;
        external_event_id: string;
        facebook_config_id: string | null;
        id: string;
        organization_id: string | null;
        page_id: string | null;
        payload: unknown;
        processing_status: string | null;
      }>();

    if (error || !event || event.processing_status === 'processed') {
      return;
    }

    try {
      const envelope = this.parseEnvelope(event.payload);
      if (!envelope || envelope.kind !== 'message' || !envelope.text) {
        await client
          .from('facebook_message_events')
          .update({
            processing_status: 'ignored',
            processed_at: new Date().toISOString(),
          })
          .eq('id', eventId);
        return;
      }

      const config = await this.resolveConfig(envelope.recipientId || event.page_id);
      if (!config) {
        await client
          .from('facebook_message_events')
          .update({
            processing_status: 'failed',
            processed_at: new Date().toISOString(),
            last_error: 'No connected Facebook config for page',
          })
          .eq('id', eventId);
        return;
      }

      const inboundAt = new Date(envelope.timestampMs).toISOString();
      const windowExpires = new Date(envelope.timestampMs + WINDOW_MS).toISOString();
      const displayName = await this.resolveSenderDisplayName({
        accessTokenEncrypted: config.access_token_encrypted,
        organizationId: config.organization_id,
        senderId: envelope.senderId,
      });

      const { data: contact } = await client
        .from('contacts')
        .upsert(
          {
            organization_id: config.organization_id,
            business_center_id: config.business_center_id,
            channel: 'facebook',
            external_contact_id: envelope.senderId,
            display_name: displayName,
            last_seen_at: inboundAt,
          },
          { onConflict: 'organization_id,channel,external_contact_id' },
        )
        .select('id')
        .single<{ id: string }>();

      const { data: conversation, error: conversationError } = await client
        .from('conversations')
        .upsert(
          {
            organization_id: config.organization_id,
            business_center_id: config.business_center_id,
            channel: 'facebook',
            external_contact_id: envelope.senderId,
            contact_id: contact?.id ?? null,
            customer_display_name: displayName,
            status: 'open',
            last_message_at: inboundAt,
            last_inbound_at: inboundAt,
            messaging_window_expires_at: windowExpires,
            facebook_config_id: config.id,
          },
          { onConflict: 'organization_id,channel,external_contact_id' },
        )
        .select('id')
        .single<{ id: string }>();

      if (conversationError || !conversation) {
        throw new Error(conversationError?.message ?? 'conversation upsert failed');
      }

      const { error: messageError } = await client.from('conversation_messages').insert({
        organization_id: config.organization_id,
        business_center_id: config.business_center_id,
        conversation_id: conversation.id,
        direction: 'inbound',
        external_message_id: envelope.mid,
        sender_phone: envelope.senderId,
        message_type: 'text',
        body: envelope.text,
        message_status: 'received',
        metadata: {
          source: 'facebook_webhook',
          eventId,
        },
      });

      if (messageError && messageError.code !== '23505') {
        throw new Error(messageError.message);
      }

      void this.notificationsService
        ?.notifyInboxNewMessage({
          bodyPreview: envelope.text,
          businessCenterId: config.business_center_id,
          conversationId: conversation.id,
          messageId: envelope.mid,
          organizationId: config.organization_id,
          senderLabel: displayName ?? envelope.senderId,
        })
        .catch((error: unknown) => {
          this.logger.error(
            error instanceof Error ? error.message : 'Facebook inbox notification failed',
          );
        });

      await client
        .from('facebook_message_events')
        .update({
          organization_id: config.organization_id,
          business_center_id: config.business_center_id,
          facebook_config_id: config.id,
          processing_status: 'processed',
          processed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', eventId);
    } catch (processError) {
      await client
        .from('facebook_message_events')
        .update({
          processing_status: 'failed',
          last_error:
            processError instanceof Error ? processError.message : 'processing failed',
        })
        .eq('id', eventId);
    }
  }

  parseEnvelope(payload: unknown): FacebookInboundEnvelope | null {
    const root = payload as {
      entry?: Array<{
        id?: string;
        messaging?: Array<{
          message?: { mid?: string; text?: string };
          delivery?: unknown;
          read?: unknown;
          postback?: unknown;
          referral?: unknown;
          recipient?: { id?: string };
          sender?: { id?: string };
          timestamp?: number;
        }>;
      }>;
      object?: string;
      // Stored single messaging event shape from webhook service
      message?: { mid?: string; text?: string };
      sender?: { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
    };

    if (root.message?.mid && root.sender?.id) {
      return {
        mid: root.message.mid,
        senderId: root.sender.id,
        recipientId: root.recipient?.id ?? '',
        text: root.message.text?.trim() || null,
        timestampMs: root.timestamp ?? Date.now(),
        raw: payload,
        kind: 'message',
      };
    }

    for (const entry of root.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        if (event.message?.mid && event.sender?.id) {
          return {
            mid: event.message.mid,
            senderId: event.sender.id,
            recipientId: event.recipient?.id ?? entry.id ?? '',
            text: event.message.text?.trim() || null,
            timestampMs: event.timestamp ?? Date.now(),
            raw: event,
            kind: 'message',
          };
        }
        if (event.read) {
          return {
            mid: `seen:${event.sender?.id}:${event.timestamp ?? Date.now()}`,
            senderId: event.sender?.id ?? '',
            recipientId: event.recipient?.id ?? entry.id ?? '',
            text: null,
            timestampMs: event.timestamp ?? Date.now(),
            raw: event,
            kind: 'seen',
          };
        }
      }
    }

    return null;
  }

  private async resolveSenderDisplayName(params: {
    accessTokenEncrypted: string | null;
    organizationId: string;
    senderId: string;
  }): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data: existing } = await client
      .from('contacts')
      .select('display_name')
      .eq('organization_id', params.organizationId)
      .eq('channel', 'facebook')
      .eq('external_contact_id', params.senderId)
      .maybeSingle<{ display_name: string | null }>();

    const existingName = existing?.display_name?.trim() || null;
    if (existingName) {
      return existingName;
    }

    if (!params.accessTokenEncrypted) {
      return null;
    }

    try {
      const accessToken = decryptSecret(
        params.accessTokenEncrypted,
        this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY'),
      );
      const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${params.senderId}`);
      url.searchParams.set('fields', 'first_name,last_name,name');
      url.searchParams.set('access_token', accessToken);
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json()) as {
        first_name?: string;
        last_name?: string;
        name?: string;
      };
      const parts = [payload.first_name, payload.last_name]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part));
      if (parts.length > 0) {
        return parts.join(' ');
      }
      return payload.name?.trim() || null;
    } catch {
      return null;
    }
  }

  private async resolveConfig(recipientId: string | null): Promise<{
    access_token_encrypted: string | null;
    business_center_id: string;
    id: string;
    organization_id: string;
  } | null> {
    if (!recipientId) {
      return null;
    }
    const client = this.supabaseService.getServiceRoleClient();
    const { data } = await client
      .from('facebook_config')
      .select('id, organization_id, business_center_id, access_token_encrypted')
      .eq('page_id', recipientId)
      .eq('connection_status', 'connected')
      .maybeSingle<{
        access_token_encrypted: string | null;
        business_center_id: string;
        id: string;
        organization_id: string;
      }>();
    return data;
  }
}
