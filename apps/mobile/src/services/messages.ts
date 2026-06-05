import { supabase } from '../lib/supabase';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';

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
  external_contact_id: string;
  customer_display_name: string | null;
  status: 'open' | 'closed';
  last_message_at: string | null;
  contacts: ContactRow | ContactRow[] | null;
}

export async function getInboxConversations(
  organizationId: string,
): Promise<InboxConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id, external_contact_id, customer_display_name, status, last_message_at, contacts(id, display_name, phone_number, lead_status)',
    )
    .eq('organization_id', organizationId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  const conversations = (data as ConversationRow[]).map(toInboxConversationSummary);
  const messages = await getRecentConversationMessages(organizationId);
  const latestMessagesByConversation = new Map(
    messages.map((message) => [message.conversationId, message]),
  );

  return conversations.map((conversation) => ({
    ...conversation,
    latestMessage: latestMessagesByConversation.get(conversation.id) ?? null,
  }));
}

export async function getRecentConversationMessages(
  organizationId: string,
): Promise<WhatsAppMessagePreview[]> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, direction, body, message_status, sender_phone, recipient_phone, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(10);

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
  onMessage: (message: WhatsAppMessagePreview) => void,
): () => void {
  const channel = supabase
    .channel(`conversation-messages:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
        filter: `organization_id=eq.${organizationId}`,
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
  handlers: {
    onConversationChange: () => void;
    onMessage: (message: WhatsAppMessagePreview) => void;
  },
): () => void {
  const channel = supabase
    .channel(`inbox:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `organization_id=eq.${organizationId}`,
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
        filter: `organization_id=eq.${organizationId}`,
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
