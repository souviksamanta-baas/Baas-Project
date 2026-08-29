import type { Channel } from '../api/mockData';
import type { InboxConversationSummary } from '../types/messages';
import { conversationDisplayName, conversationPreview } from './inboxPresentation';

export type InboxChannelFilter = Channel | 'all';
export type InboxStatusFilter = 'all' | 'new' | 'opportunity' | 'open' | 'archived';

export interface InboxListFilters {
  channel: InboxChannelFilter;
  query: string;
  status: InboxStatusFilter;
}

export const defaultInboxFilters: InboxListFilters = {
  channel: 'all',
  query: '',
  status: 'all',
};

export function filterInboxConversations(
  conversations: InboxConversationSummary[],
  filters: InboxListFilters,
): InboxConversationSummary[] {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return conversations.filter((conversation) => {
    if (conversation.deletedAt) {
      return false;
    }

    if (filters.channel !== 'all' && conversation.channel !== filters.channel) {
      return false;
    }

    if (filters.status === 'open') {
      if (conversation.status !== 'open' || conversation.archivedAt) {
        return false;
      }
    }

    if (filters.status === 'archived') {
      if (!(conversation.status === 'closed' || conversation.archivedAt)) {
        return false;
      }
    } else if (!normalizedQuery && (conversation.status === 'closed' || conversation.archivedAt)) {
      // Default list hides archived unless searching or filtering Archivado.
      if (filters.status === 'all') {
        return false;
      }
    }

    if (filters.status === 'new' && conversation.contact.leadStatus !== 'new') {
      return false;
    }

    if (filters.status === 'opportunity' && conversation.contact.leadStatus !== 'opportunity') {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      conversationDisplayName(conversation),
      conversationPreview(conversation),
      conversation.contact.phoneNumber ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
