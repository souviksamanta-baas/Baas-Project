import { supabase } from '../lib/supabase';
import type { LeadStatus } from '../types/messages';

export type ManualLeadStatus = Extract<LeadStatus, 'won' | 'lost' | 'finished'>;

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ last_owner_read_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markConversationUnread(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ last_owner_read_at: null })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function archiveConversation(conversationId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('conversations')
    .update({
      archived_at: now,
      status: 'closed',
    })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function unarchiveConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      archived_at: null,
      status: 'open',
    })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearConversationMessages(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ messages_cleared_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateContactLeadStatus(params: {
  contactId: string;
  leadStatus: ManualLeadStatus;
}): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({
      lead_status: params.leadStatus,
      lead_status_changed_at: new Date().toISOString(),
      cold_at: null,
    })
    .eq('id', params.contactId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function hideConversationMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_messages')
    .update({ owner_hidden_at: new Date().toISOString() })
    .eq('id', messageId);

  if (error) {
    throw new Error(error.message);
  }
}
