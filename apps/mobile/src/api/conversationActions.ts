import { supabase } from '../lib/supabase';
import type { LeadStatus } from '../types/messages';

export type ManualLeadStatus = Extract<
  LeadStatus,
  'new' | 'active' | 'opportunity' | 'won' | 'lost' | 'finished'
>;

/** Far-future timestamp used for "mute always". */
export const MUTE_ALWAYS_UNTIL = '2999-01-01T00:00:00.000Z';

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

export async function toggleConversationRead(params: {
  conversationId: string;
  isUnread: boolean;
}): Promise<void> {
  if (params.isUnread) {
    await markConversationRead(params.conversationId);
    return;
  }
  await markConversationUnread(params.conversationId);
}

export async function pinConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ pinned_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function unpinConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ pinned_at: null })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function muteConversation(params: {
  conversationId: string;
  until: string;
}): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ muted_until: params.until })
    .eq('id', params.conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function unmuteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ muted_until: null })
    .eq('id', conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export function isConversationMuted(mutedUntil: string | null | undefined): boolean {
  if (!mutedUntil) {
    return false;
  }
  return new Date(mutedUntil).getTime() > Date.now();
}

export function muteUntilPreset(preset: '8h' | '1w' | 'always'): string {
  if (preset === 'always') {
    return MUTE_ALWAYS_UNTIL;
  }
  const ms = preset === '8h' ? 8 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
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

export async function assignConversationToCopi(params: {
  conversationId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      assigned_to_copi_at: new Date().toISOString(),
      assigned_to_copi_user_id: params.userId,
    })
    .eq('id', params.conversationId);

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
