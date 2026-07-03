import type { Channel } from '../api/mockData';
import type { InboxConversationSummary } from '../types/messages';
import { conversationDisplayName, conversationPreview } from './inboxPresentation';

export type InboxChannelFilter = Channel | 'all';
export type InboxStatusFilter = 'all' | 'new' | 'open' | 'archived';

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
    if (filters.channel !== 'all' && conversation.channel !== filters.channel) {
      return false;
    }

    if (filters.status === 'open' && conversation.status !== 'open') {
      return false;
    }

    if (filters.status === 'archived' && conversation.status !== 'closed') {
      return false;
    }

    if (filters.status === 'new' && conversation.contact.leadStatus !== 'new') {
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
