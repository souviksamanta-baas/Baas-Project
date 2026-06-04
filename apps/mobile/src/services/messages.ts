import { supabase } from '../lib/supabase';
import type { WhatsAppMessagePreview } from '../types/messages';

interface ConversationMessageRow {
  id: string;
  body: string | null;
  created_at: string;
  direction: 'inbound' | 'outbound';
  message_status: string;
  recipient_phone: string | null;
  sender_phone: string | null;
}

export async function getRecentConversationMessages(
  organizationId: string,
): Promise<WhatsAppMessagePreview[]> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, direction, body, message_status, sender_phone, recipient_phone, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(10);

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

function toWhatsAppMessagePreview(row: ConversationMessageRow): WhatsAppMessagePreview {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    direction: row.direction,
    messageStatus: row.message_status,
    recipientPhone: row.recipient_phone,
    senderPhone: row.sender_phone,
  };
}
