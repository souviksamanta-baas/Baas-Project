import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { askOwnerCopilot } from '../services/copilot';
import type { CopilotMessage } from '../types/copilot';

export interface OwnerCopilotState {
  errorMessage: string | null;
  inputValue: string;
  isAsking: boolean;
  messages: CopilotMessage[];
  askQuestion: (question?: string) => Promise<void>;
  setInputValue: (value: string) => void;
}

const starterMessage: CopilotMessage = {
  body: 'Ask about messages today, low stock, or pending follow-ups.',
  createdAt: new Date(0).toISOString(),
  id: 'starter',
  role: 'assistant',
};

export function useOwnerCopilot(organizationId: string | null): OwnerCopilotState {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([starterMessage]);

  const askQuestion = useCallback(
    async (questionOverride?: string): Promise<void> => {
      if (!organizationId) {
        return;
      }

      const question = (questionOverride ?? inputValue).trim();

      if (!question) {
        return;
      }

      const askedAt = new Date().toISOString();
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          body: question,
          createdAt: askedAt,
          id: `owner:${askedAt}`,
          role: 'owner',
        },
      ]);
      setInputValue('');
      setIsAsking(true);
      setErrorMessage(null);

      try {
        const response = await askOwnerCopilot({
          organizationId,
          question,
        });
        const answeredAt = new Date().toISOString();
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            body: `${response.answer}\n\nAnswered in ${response.responseTimeMs}ms using ${response.tools.join(', ')}.`,
            createdAt: answeredAt,
            id: `assistant:${answeredAt}`,
            role: 'assistant',
          },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Owner copilot failed', message);
      } finally {
        setIsAsking(false);
      }
    },
    [inputValue, organizationId],
  );

  return {
    errorMessage,
    inputValue,
    isAsking,
    messages,
    askQuestion,
    setInputValue,
  };
}
