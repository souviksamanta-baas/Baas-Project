import { useEffect, useState } from 'react';

import {
  getConversationMessages,
  subscribeToConversationMessages,
} from '../services/messages';
import type { WhatsAppMessagePreview } from '../types/messages';

export function useConversationThread(params: {
  businessCenterId: string | null;
  conversationId: string | null;
  organizationId: string | null;
}): {
  errorMessage: string | null;
  isLoading: boolean;
  messages: WhatsAppMessagePreview[];
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

  return {
    errorMessage,
    isLoading,
    messages,
  };
}
