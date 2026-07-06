import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { askOwnerCopilot, confirmCopiAction, getCopiSessionMessages } from '../api/ai';
import type { CopilotMessage } from '../types/copilot';

export interface OwnerCopilotState {
  confirmProposedAction: (actionId: string) => Promise<void>;
  errorMessage: string | null;
  inputValue: string;
  isAsking: boolean;
  messages: CopilotMessage[];
  policyMessage: string | null;
  askQuestion: (question?: string) => Promise<void>;
  sessionId: string | null;
  setInputValue: (value: string) => void;
}

const starterMessage: CopilotMessage = {
  body: 'Preguntame por ventas, stock, conversaciones o seguimientos pendientes.',
  createdAt: new Date(0).toISOString(),
  id: 'starter',
  role: 'assistant',
};

export function useOwnerCopilot(params: {
  businessCenterId: string | null;
  organizationId: string | null;
}): OwnerCopilotState {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([starterMessage]);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!params.organizationId || !sessionId) {
      return;
    }

    getCopiSessionMessages({ organizationId: params.organizationId, sessionId })
      .then((history) => {
        if (history.length === 0) {
          return;
        }

        setMessages([
          starterMessage,
          ...history
            .filter((message) => message.role !== 'system')
            .map(
              (message): CopilotMessage => ({
                body: message.body,
                createdAt: message.createdAt,
                id: message.id,
                role: message.role === 'owner' ? 'owner' : 'assistant',
              }),
            ),
        ]);
      })
      .catch(() => undefined);
  }, [params.organizationId, sessionId]);

  const askQuestion = useCallback(
    async (questionOverride?: string): Promise<void> => {
      if (!params.organizationId) {
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
      setPolicyMessage(null);

      try {
        const response = await askOwnerCopilot({
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          question,
          sessionId,
        });
        const answeredAt = new Date().toISOString();
        setSessionId(response.sessionId);

        if (response.policyDecision !== 'allowed') {
          setPolicyMessage(response.answer);
        }

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            body: response.answer,
            createdAt: answeredAt,
            id: `assistant:${answeredAt}`,
            proposedActionId: response.proposedAction?.id ?? null,
            proposedActionSummary: response.proposedAction?.summary ?? null,
            role: 'assistant',
          },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Copi no respondió', message);
      } finally {
        setIsAsking(false);
      }
    },
    [inputValue, params.businessCenterId, params.organizationId, sessionId],
  );

  const confirmProposedAction = useCallback(
    async (actionId: string): Promise<void> => {
      if (!params.organizationId || !params.businessCenterId) {
        return;
      }

      try {
        const result = await confirmCopiAction({
          actionId,
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
        });
        const answeredAt = new Date().toISOString();
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            body: `Listo. Acción confirmada (${result.status}).`,
            createdAt: answeredAt,
            id: `assistant:action:${answeredAt}`,
            role: 'assistant',
          },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('No se pudo confirmar la acción', message);
      }
    },
    [params.businessCenterId, params.organizationId],
  );

  return {
    confirmProposedAction,
    errorMessage,
    inputValue,
    isAsking,
    messages,
    policyMessage,
    askQuestion,
    sessionId,
    setInputValue,
  };
}
