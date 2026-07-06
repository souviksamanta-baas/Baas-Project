import { useCallback, useEffect, useState } from 'react';

import {
  getConversationMessages,
  getInboxConversationById,
  subscribeToConversationMessages,
} from '../api/conversations';
import { sendConversationReply } from '../api/whatsapp';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';

export function useInboxConversation(params: {
  businessCenterId: string | null;
  conversationId: string | null;
  organizationId: string | null;
}): {
  conversation: InboxConversationSummary | null;
  isLoading: boolean;
} {
  const [conversation, setConversation] = useState<InboxConversationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!params.organizationId || !params.businessCenterId || !params.conversationId) {
      setConversation(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    getInboxConversationById(
      params.organizationId,
      params.businessCenterId,
      params.conversationId,
    )
      .then((nextConversation) => {
        if (mounted) {
          setConversation(nextConversation);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [params.businessCenterId, params.conversationId, params.organizationId]);

  return { conversation, isLoading };
}

export function useConversationThread(params: {
  businessCenterId: string | null;
  conversationId: string | null;
  organizationId: string | null;
}): {
  errorMessage: string | null;
  isLoading: boolean;
  messages: WhatsAppMessagePreview[];
  sendReply: (body: string) => Promise<void>;
} {
  const [messages, setMessages] = useState<WhatsAppMessagePreview[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!params.conversationId) {
      setMessages([]);
      return undefined;
    }

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    getConversationMessages(params.conversationId)
      .then((threadMessages) => {
        if (mounted) {
          setMessages(threadMessages);
        }
      })
      .catch((error) => {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    if (!params.organizationId || !params.businessCenterId) {
      return () => {
        mounted = false;
      };
    }

    const unsubscribe = subscribeToConversationMessages(
      params.organizationId,
      params.businessCenterId,
      (message) => {
        if (message.conversationId !== params.conversationId) {
          return;
        }

        setMessages((currentMessages) => {
          const withoutCurrent = currentMessages.filter((current) => current.id !== message.id);
          return [...withoutCurrent, message].sort(
            (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
          );
        });
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [params.businessCenterId, params.conversationId, params.organizationId]);

  const sendReply = useCallback(
    async (body: string): Promise<void> => {
      if (!params.organizationId || !params.businessCenterId || !params.conversationId) {
        throw new Error('Missing conversation context.');
      }

      await sendConversationReply({
        body,
        businessCenterId: params.businessCenterId,
        conversationId: params.conversationId,
        organizationId: params.organizationId,
      });
    },
    [params.businessCenterId, params.conversationId, params.organizationId],
  );

  return {
    errorMessage,
    isLoading,
    messages,
    sendReply,
  };
}
