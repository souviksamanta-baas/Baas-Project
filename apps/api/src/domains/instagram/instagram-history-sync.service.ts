import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class InstagramHistorySyncService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Best-effort import. Meta does not return every historical DM
   * (Requests folder / 30-day gaps / limited media). Failures must not
   * roll back a successful OAuth connection.
   */
  async importRecentConversations(params: {
    accessToken: string;
    businessCenterId: string;
    igUserId: string;
    instagramConfigId?: string;
    organizationId: string;
  }): Promise<{ importedConversations: number; importedMessages: number }> {
    const client = this.supabaseService.getServiceRoleClient();
    let importedConversations = 0;
    let importedMessages = 0;

    const url = new URL(`https://graph.instagram.com/v21.0/${params.igUserId}/conversations`);
    url.searchParams.set('platform', 'instagram');
    url.searchParams.set('fields', 'id,updated_time,participants,messages{id,created_time,from,to,message}');
    url.searchParams.set('limit', '25');
    url.searchParams.set('access_token', params.accessToken);

    const response = await fetch(url);
    if (!response.ok) {
      return { importedConversations: 0, importedMessages: 0 };
    }

    const payload = (await response.json()) as {
      data?: Array<{
        id?: string;
        messages?: {
          data?: Array<{
            created_time?: string;
            from?: { id?: string; username?: string };
            id?: string;
            message?: string;
          }>;
        };
        participants?: { data?: Array<{ id?: string; username?: string }> };
      }>;
    };

    for (const thread of payload.data ?? []) {
      const participants = thread.participants?.data ?? [];
      const customer = participants.find((p) => p.id && p.id !== params.igUserId);
      if (!customer?.id) {
        continue;
      }

      const { data: contact } = await client
        .from('contacts')
        .upsert(
          {
            organization_id: params.organizationId,
            business_center_id: params.businessCenterId,
            channel: 'instagram',
            external_contact_id: customer.id,
            display_name: customer.username ?? null,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,channel,external_contact_id' },
        )
        .select('id')
        .single<{ id: string }>();

      const messages = [...(thread.messages?.data ?? [])].reverse();
      const lastMessage = messages[messages.length - 1];
      const lastAt = lastMessage?.created_time ?? new Date().toISOString();
      const lastInbound = [...messages].reverse().find((m) => m.from?.id === customer.id);
      const lastInboundAt = lastInbound?.created_time ?? null;
      const windowExpires = lastInboundAt
        ? new Date(new Date(lastInboundAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: conversation } = await client
        .from('conversations')
        .upsert(
          {
            organization_id: params.organizationId,
            business_center_id: params.businessCenterId,
            channel: 'instagram',
            external_contact_id: customer.id,
            contact_id: contact?.id ?? null,
            status: 'open',
            last_message_at: lastAt,
            last_inbound_at: lastInboundAt,
            messaging_window_expires_at: windowExpires,
            instagram_config_id: params.instagramConfigId ?? null,
          },
          { onConflict: 'organization_id,channel,external_contact_id' },
        )
        .select('id')
        .single<{ id: string }>();

      if (!conversation) {
        continue;
      }

      importedConversations += 1;

      for (const message of messages.slice(-50)) {
        if (!message.id || !message.message?.trim()) {
          continue;
        }
        const fromCustomer = message.from?.id === customer.id;
        const createdAt = message.created_time ?? lastAt;
        const { error } = await client.from('conversation_messages').insert({
          organization_id: params.organizationId,
          business_center_id: params.businessCenterId,
          conversation_id: conversation.id,
          direction: fromCustomer ? 'inbound' : 'outbound',
          external_message_id: message.id,
          sender_phone: message.from?.id ?? null,
          recipient_phone: fromCustomer ? params.igUserId : customer.id,
          message_type: 'text',
          body: message.message,
          message_status: fromCustomer ? 'received' : 'sent',
          sent_at: fromCustomer ? null : createdAt,
          metadata: { source: 'instagram_history_sync' },
          created_at: createdAt,
        });
        if (!error || error.code === '23505') {
          if (!error) {
            importedMessages += 1;
          }
        }
      }
    }

    return { importedConversations, importedMessages };
  }
}
