import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface InstagramInboundEnvelope {
  mid: string;
  senderId: string;
  recipientId: string;
  text: string | null;
  timestampMs: number;
  raw: unknown;
  kind: 'message' | 'seen' | 'reaction' | 'postback' | 'referral' | 'other';
}

@Injectable()
export class InstagramEventProcessor {
  private readonly logger = new Logger(InstagramEventProcessor.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  scheduleProcess(eventIds: string[]): void {
    setImmediate(() => {
      void this.processEventIds(eventIds).catch((error: unknown) => {
        this.logger.error(
          error instanceof Error ? error.message : 'Instagram event processing failed',
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
      .from('instagram_message_events')
      .select(
        'id, organization_id, business_center_id, instagram_config_id, external_message_id, sender_igsid, payload, webhook_timestamp, processed_at',
      )
      .eq('id', eventId)
      .maybeSingle<{
        business_center_id: string | null;
        external_message_id: string;
        id: string;
        instagram_config_id: string | null;
        organization_id: string | null;
        payload: unknown;
        processed_at: string | null;
        sender_igsid: string | null;
        webhook_timestamp: string | null;
      }>();

    if (error || !event || event.processed_at) {
      return;
    }

    try {
      const envelope = this.parseEnvelope(event.payload);
      if (!envelope || envelope.kind !== 'message' || !envelope.text) {
        await client
          .from('instagram_message_events')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', eventId);
        return;
      }

      const config = await this.resolveConfig(envelope.recipientId);
      if (!config) {
        await client
          .from('instagram_message_events')
          .update({
            processed_at: new Date().toISOString(),
            process_error: 'No connected Instagram config for recipient',
          })
          .eq('id', eventId);
        return;
      }

      const inboundAt = new Date(envelope.timestampMs).toISOString();
      const windowExpires = new Date(envelope.timestampMs + WINDOW_MS).toISOString();

      const { data: contact } = await client
        .from('contacts')
        .upsert(
          {
            organization_id: config.organization_id,
            business_center_id: config.business_center_id,
            channel: 'instagram',
            external_contact_id: envelope.senderId,
            display_name: null,
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
            channel: 'instagram',
            external_contact_id: envelope.senderId,
            contact_id: contact?.id ?? null,
            status: 'open',
            last_message_at: inboundAt,
            last_inbound_at: inboundAt,
            messaging_window_expires_at: windowExpires,
            instagram_config_id: config.id,
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
          source: 'instagram_webhook',
          eventId,
        },
      });

      if (messageError && messageError.code !== '23505') {
        throw new Error(messageError.message);
      }

      await client
        .from('instagram_message_events')
        .update({
          organization_id: config.organization_id,
          business_center_id: config.business_center_id,
          instagram_config_id: config.id,
          processed_at: new Date().toISOString(),
          process_error: null,
        })
        .eq('id', eventId);
    } catch (processError) {
      await client
        .from('instagram_message_events')
        .update({
          process_error:
            processError instanceof Error ? processError.message : 'processing failed',
        })
        .eq('id', eventId);
    }
  }

  parseEnvelope(payload: unknown): InstagramInboundEnvelope | null {
    const root = payload as {
      entry?: Array<{
        id?: string;
        messaging?: Array<{
          message?: { mid?: string; text?: string };
          read?: unknown;
          reaction?: unknown;
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

  private async resolveConfig(recipientId: string): Promise<{
    business_center_id: string;
    id: string;
    organization_id: string;
  } | null> {
    if (!recipientId) {
      return null;
    }
    const client = this.supabaseService.getServiceRoleClient();
    const { data } = await client
      .from('instagram_config')
      .select('id, organization_id, business_center_id')
      .or(`ig_user_id.eq.${recipientId},page_id.eq.${recipientId}`)
      .eq('connection_status', 'connected')
      .maybeSingle<{
        business_center_id: string;
        id: string;
        organization_id: string;
      }>();
    return data;
  }
}
