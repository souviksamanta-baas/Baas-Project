import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import {
  getConversationMessages,
  getInboxConversations,
  subscribeToInboxChanges,
} from '../services/messages';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';

export interface InboxState {
  conversations: InboxConversationSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  messages: WhatsAppMessagePreview[];
  selectedConversation: InboxConversationSummary | null;
  selectConversation: (conversationId: string) => void;
}

export function useInbox(organizationId: string | null): InboxState {
  const [conversations, setConversations] = useState<InboxConversationSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<WhatsAppMessagePreview[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const loadConversations = useCallback(async (): Promise<void> => {
    if (!organizationId) {
      setConversations([]);
      setSelectedConversationId(null);
      return;
    }

    const nextConversations = await getInboxConversations(organizationId);
    setConversations(nextConversations);
    setSelectedConversationId((currentConversationId) => {
      if (currentConversationId && nextConversations.some((item) => item.id === currentConversationId)) {
        return currentConversationId;
      }

      return nextConversations[0]?.id ?? null;
    });
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setConversations([]);
      setMessages([]);
      setSelectedConversationId(null);
      return undefined;
    }

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    loadConversations()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Could not load inbox', message);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeToInboxChanges(organizationId, {
      onConversationChange: () => {
        void loadConversations();
      },
      onMessage: (message) => {
        setMessages((currentMessages) => {
          if (message.conversationId !== selectedConversationId) {
            return currentMessages;
          }

          return [...currentMessages.filter((current) => current.id !== message.id), message];
        });
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadConversations, organizationId, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    getConversationMessages(selectedConversationId)
      .then(setMessages)
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Could not load thread', message);
      });
  }, [selectedConversationId]);

  return {
    conversations,
    errorMessage,
    isLoading,
    messages,
    selectedConversation,
    selectConversation: setSelectedConversationId,
  };
}
