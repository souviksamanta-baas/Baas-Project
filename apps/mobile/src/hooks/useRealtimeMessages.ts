import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  getRecentConversationMessages,
  subscribeToConversationMessages,
} from '../services/messages';
import type { WhatsAppMessagePreview } from '../types/messages';

export function useRealtimeMessages(organizationId: string | null): WhatsAppMessagePreview[] {
  const [messages, setMessages] = useState<WhatsAppMessagePreview[]>([]);

  useEffect(() => {
    if (!organizationId) {
      setMessages([]);
      return undefined;
    }

    let mounted = true;

    getRecentConversationMessages(organizationId)
      .then((recentMessages) => {
        if (mounted) {
          setMessages(recentMessages);
        }
      })
      .catch((error) => {
        Alert.alert(
          'Could not load messages',
          error instanceof Error ? error.message : 'Unknown error',
        );
      });

    const unsubscribe = subscribeToConversationMessages(organizationId, (message) => {
      setMessages((currentMessages) =>
        [message, ...currentMessages.filter((current) => current.id !== message.id)].slice(0, 10),
      );
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [organizationId]);

  return messages;
}
