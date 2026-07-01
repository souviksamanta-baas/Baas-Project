import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  getRecentConversationMessages,
  subscribeToConversationMessages,
} from '../api/conversations';
import type { WhatsAppMessagePreview } from '../types/messages';

export function useRealtimeMessages(
  organizationId: string | null,
  businessCenterId: string | null,
): WhatsAppMessagePreview[] {
  const [messages, setMessages] = useState<WhatsAppMessagePreview[]>([]);

  useEffect(() => {
    if (!organizationId || !businessCenterId) {
      setMessages([]);
      return undefined;
    }

    let mounted = true;

    getRecentConversationMessages(organizationId, businessCenterId)
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

    const unsubscribe = subscribeToConversationMessages(organizationId, businessCenterId, (message) => {
      setMessages((currentMessages) =>
        [message, ...currentMessages.filter((current) => current.id !== message.id)].slice(0, 10),
      );
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [businessCenterId, organizationId]);

  return messages;
}
