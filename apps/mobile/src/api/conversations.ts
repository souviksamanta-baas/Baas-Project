import { removeExistingRealtimeChannel } from '../lib/realtime';
import { supabase } from '../lib/supabase';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';
import type { ConversationChannel } from '../types/messages';

interface ConversationMessageRow {
  conversation_id: string;
  id: string;
  body: string | null;
  created_at: string;
  direction: 'inbound' | 'outbound';
  edited_at?: string | null;
  link_preview?: Record<string, unknown> | null;
  media_duration_ms?: number | null;
  media_mime_type: string | null;
  media_storage_path: string | null;
  media_url: string | null;
  message_status: string;
  message_type: string | null;
  owner_hidden_at?: string | null;
  recipient_phone: string | null;
  reply_to_message_id?: string | null;
  sender_phone: string | null;
}

interface ContactRow {
  id: string | null;
  display_name: string | null;
  phone_number: string | null;
  lead_status:
    | 'new'
    | 'active'
    | 'cold'
    | 'won'
    | 'lost'
    | 'opportunity'
    | 'finished'
    | null;
}

interface ConversationRow {
  id: string;
  archived_at: string | null;
  channel: ConversationChannel;
  deleted_at: string | null;
  external_contact_id: string;
  customer_display_name: string | null;
  last_owner_read_at: string | null;
  messages_cleared_at: string | null;
  status: 'open' | 'closed';
  last_message_at: string | null;
  contacts: ContactRow | ContactRow[] | null;
}

export interface GetInboxConversationsOptions {
  limit?: number;
}

export async function getInboxConversations(
  organizationId: string,
  businessCenterId: string,
  options?: GetInboxConversationsOptions,
): Promise<InboxConversationSummary[]> {
  let query = supabase
    .from('conversations')
    .select(
      'id, channel, external_contact_id, customer_display_name, status, last_message_at, last_owner_read_at, archived_at, deleted_at, messages_cleared_at, contacts(id, display_name, phone_number, lead_status)',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const conversations = (data as ConversationRow[]).map(toInboxConversationSummary);
  const latestMessagesByConversation = await getLatestMessagesForConversations(
    organizationId,
    businessCenterId,
    conversations.map((conversation) => conversation.id),
  );

  return conversations.map((conversation) => {
    const latest = latestMessagesByConversation.get(conversation.id) ?? null;
    return {
      ...conversation,
      latestMessage: latest,
      unreadCount: computeUnreadCount({
        direction: latest?.direction,
        lastMessageAt: conversation.lastMessageAt,
        lastOwnerReadAt: conversation.lastOwnerReadAt,
      }),
    };
  });
}

export async function getInboxConversationById(
  organizationId: string,
  businessCenterId: string,
  conversationId: string,
): Promise<InboxConversationSummary | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id, channel, external_contact_id, customer_display_name, status, last_message_at, last_owner_read_at, archived_at, deleted_at, messages_cleared_at, contacts(id, display_name, phone_number, lead_status)',
    )
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const conversation = toInboxConversationSummary(data as ConversationRow);
  const latestMessagesByConversation = await getLatestMessagesForConversations(
    organizationId,
    businessCenterId,
    [conversationId],
  );

  return {
    ...conversation,
    latestMessage: latestMessagesByConversation.get(conversationId) ?? null,
  };
}

async function getLatestMessagesForConversations(
  organizationId: string,
  businessCenterId: string,
  conversationIds: string[],
): Promise<Map<string, WhatsAppMessagePreview>> {
  if (conversationIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, direction, body, message_type, message_status, media_url, media_storage_path, media_mime_type, sender_phone, recipient_phone, created_at')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(Math.min(conversationIds.length * 5, 100));

  if (error) {
    throw new Error(error.message);
  }

  const latestMessagesByConversation = new Map<string, WhatsAppMessagePreview>();
  for (const message of (data as ConversationMessageRow[]).map(toWhatsAppMessagePreview)) {
    if (!latestMessagesByConversation.has(message.conversationId)) {
      latestMessagesByConversation.set(message.conversationId, message);
    }
  }

  return latestMessagesByConversation;
}

export async function getRecentConversationMessages(
  organizationId: string,
  businessCenterId: string,
): Promise<WhatsAppMessagePreview[]> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, direction, body, message_type, message_status, media_url, media_storage_path, media_mime_type, sender_phone, recipient_phone, created_at')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data as ConversationMessageRow[]).map(toWhatsAppMessagePreview);
}

export async function getConversationMessages(
  conversationId: string,
  options?: { messagesClearedAt?: string | null },
): Promise<WhatsAppMessagePreview[]> {
  let query = supabase
    .from('conversation_messages')
    .select(
      'id, conversation_id, direction, body, message_type, message_status, media_url, media_storage_path, media_mime_type, media_duration_ms, sender_phone, recipient_phone, created_at, edited_at, reply_to_message_id, link_preview, owner_hidden_at',
    )
    .eq('conversation_id', conversationId)
    .is('owner_hidden_at', null)
    .order('created_at', { ascending: true });

  if (options?.messagesClearedAt) {
    query = query.gt('created_at', options.messagesClearedAt);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data as ConversationMessageRow[]).map(toWhatsAppMessagePreview);
}

export function subscribeToConversationMessages(
  organizationId: string,
  businessCenterId: string,
  onMessage: (message: WhatsAppMessagePreview) => void,
): () => void {
  const channelName = `conversation-messages:${organizationId}:${businessCenterId}`;
  removeExistingRealtimeChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
        filter: `business_center_id=eq.${businessCenterId}`,
      },
      (payload) => {
        onMessage(toWhatsAppMessagePreview(payload.new as ConversationMessageRow));
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_messages',
        filter: `business_center_id=eq.${businessCenterId}`,
      },
      (payload) => {
        onMessage(toWhatsAppMessagePreview(payload.new as ConversationMessageRow));
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToInboxChanges(
  organizationId: string,
  businessCenterId: string,
  handlers: {
    onConversationChange: () => void;
    onMessage: (message: WhatsAppMessagePreview) => void;
  },
): () => void {
  const channelName = `inbox:${organizationId}:${businessCenterId}`;
  removeExistingRealtimeChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `business_center_id=eq.${businessCenterId}`,
      },
      () => {
        handlers.onConversationChange();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
        filter: `business_center_id=eq.${businessCenterId}`,
      },
      (payload) => {
        handlers.onMessage(toWhatsAppMessagePreview(payload.new as ConversationMessageRow));
        handlers.onConversationChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

function toWhatsAppMessagePreview(row: ConversationMessageRow): WhatsAppMessagePreview {
  const preview = row.link_preview ?? null;
  return {
    conversationId: row.conversation_id,
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    direction: row.direction,
    editedAt: row.edited_at ?? null,
    linkPreview:
      preview && typeof preview === 'object'
        ? {
            description:
              typeof preview.description === 'string' ? preview.description : null,
            imageUrl: typeof preview.image_url === 'string' ? preview.image_url : null,
            title: typeof preview.title === 'string' ? preview.title : null,
            url: typeof preview.url === 'string' ? preview.url : null,
          }
        : null,
    mediaDurationMs: row.media_duration_ms ?? null,
    mediaMimeType: row.media_mime_type ?? null,
    mediaStoragePath: row.media_storage_path ?? null,
    mediaUrl: row.media_url ?? null,
    messageStatus: row.message_status,
    messageType: row.message_type ?? 'text',
    recipientPhone: row.recipient_phone,
    replyToMessageId: row.reply_to_message_id ?? null,
    senderPhone: row.sender_phone,
  };
}

function computeUnreadCount(params: {
  direction: 'inbound' | 'outbound' | null | undefined;
  lastMessageAt: string | null;
  lastOwnerReadAt: string | null;
}): number {
  if (!params.lastMessageAt || params.direction !== 'inbound') {
    return 0;
  }
  if (!params.lastOwnerReadAt) {
    return 1;
  }
  return new Date(params.lastMessageAt).getTime() > new Date(params.lastOwnerReadAt).getTime()
    ? 1
    : 0;
}

function toInboxConversationSummary(row: ConversationRow): InboxConversationSummary {
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;

  return {
    archivedAt: row.archived_at ?? null,
    channel: row.channel ?? 'whatsapp',
    contact: {
      displayName: contact?.display_name ?? row.customer_display_name,
      id: contact?.id ?? null,
      leadStatus: contact?.lead_status ?? null,
      phoneNumber: contact?.phone_number ?? (row.channel === 'whatsapp' ? row.external_contact_id : null),
    },
    deletedAt: row.deleted_at ?? null,
    externalContactId: row.external_contact_id,
    id: row.id,
    lastMessageAt: row.last_message_at,
    lastOwnerReadAt: row.last_owner_read_at ?? null,
    latestMessage: null,
    messagesClearedAt: row.messages_cleared_at ?? null,
    status: row.status,
    unreadCount: 0,
  };
}
