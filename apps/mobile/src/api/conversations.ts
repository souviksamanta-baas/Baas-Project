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
  message_status: string;
  recipient_phone: string | null;
  sender_phone: string | null;
}

interface ContactRow {
  id: string | null;
  display_name: string | null;
  phone_number: string | null;
  lead_status: 'new' | 'active' | 'cold' | 'won' | 'lost' | null;
}

interface ConversationRow {
  id: string;
  channel: ConversationChannel;
  external_contact_id: string;
  customer_display_name: string | null;
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
      'id, channel, external_contact_id, customer_display_name, status, last_message_at, contacts(id, display_name, phone_number, lead_status)',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
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

  return conversations.map((conversation) => ({
    ...conversation,
    latestMessage: latestMessagesByConversation.get(conversation.id) ?? null,
  }));
}

export async function getInboxConversationById(
  organizationId: string,
  businessCenterId: string,
  conversationId: string,
): Promise<InboxConversationSummary | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id, channel, external_contact_id, customer_display_name, status, last_message_at, contacts(id, display_name, phone_number, lead_status)',
    )
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
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
    .select('id, conversation_id, direction, body, message_status, sender_phone, recipient_phone, created_at')
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
    .select('id, conversation_id, direction, body, message_status, sender_phone, recipient_phone, created_at')
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
): Promise<WhatsAppMessagePreview[]> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, direction, body, message_status, sender_phone, recipient_phone, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

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
  return {
    conversationId: row.conversation_id,
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    direction: row.direction,
    messageStatus: row.message_status,
    recipientPhone: row.recipient_phone,
    senderPhone: row.sender_phone,
  };
}

function toInboxConversationSummary(row: ConversationRow): InboxConversationSummary {
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;

  return {
    channel: row.channel ?? 'whatsapp',
    contact: {
      displayName: contact?.display_name ?? row.customer_display_name,
      id: contact?.id ?? null,
      leadStatus: contact?.lead_status ?? null,
      phoneNumber: contact?.phone_number ?? row.external_contact_id,
    },
    externalContactId: row.external_contact_id,
    id: row.id,
    lastMessageAt: row.last_message_at,
    latestMessage: null,
    status: row.status,
  };
}
