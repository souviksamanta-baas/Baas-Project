import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  askOwnerCopilot,
  confirmCopiAction,
  getActiveCopiSession,
} from '../api/ai';
import { resolveCopiNavigateRoute } from '../lib/copiNavigate';
import type { CopilotMessage } from '../types/copilot';

export interface OwnerCopilotState {
  confirmProposedAction: (actionId: string) => Promise<void>;
  errorMessage: string | null;
  hasConversationHistory: boolean;
  inputValue: string;
  isAsking: boolean;
  isLoadingHistory: boolean;
  messages: CopilotMessage[];
  policyMessage: string | null;
  askQuestion: (question?: string, options?: { imageContext?: string }) => Promise<void>;
  refreshHistory: () => Promise<void>;
  sessionId: string | null;
  setInputValue: (value: string) => void;
}

const starterMessage: CopilotMessage = {
  body: 'Preguntame por ventas, stock, conversaciones o seguimientos pendientes.',
  createdAt: new Date(0).toISOString(),
  id: 'starter',
  role: 'assistant',
};

function mapHistoryMessages(
  history: Array<{
    body: string;
    createdAt: string;
    id: string;
    role: 'assistant' | 'owner' | 'system';
  }>,
): CopilotMessage[] {
  return history
    .filter((message) => message.role !== 'system')
    .map(
      (message): CopilotMessage => ({
        body: message.body,
        createdAt: message.createdAt,
        id: message.id,
        role: message.role === 'owner' ? 'owner' : 'assistant',
      }),
    );
}

export function useOwnerCopilot(params: {
  businessCenterId: string | null;
  organizationId: string | null;
}): OwnerCopilotState {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([starterMessage]);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const askInFlightRef = useRef(false);

  const applyHistory = useCallback(
    (nextSessionId: string | null, history: ReturnType<typeof mapHistoryMessages>) => {
      setSessionId(nextSessionId);
      if (history.length === 0) {
        setMessages([starterMessage]);
        return;
      }

      setMessages([starterMessage, ...history]);
    },
    [],
  );

  const refreshHistory = useCallback(async (): Promise<void> => {
    if (!params.organizationId) {
      applyHistory(null, []);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const active = await getActiveCopiSession({
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
      });
      // Don't wipe an in-flight assign/ask — that hid the owner bubble in Copi chat.
      if (askInFlightRef.current) {
        return;
      }
      applyHistory(active.sessionId, mapHistoryMessages(active.messages));
    } catch {
      // Keep local state if resume fails (offline / transient).
    } finally {
      setIsLoadingHistory(false);
    }
  }, [applyHistory, params.businessCenterId, params.organizationId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

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
        const navigate =
          result.result &&
          typeof result.result === 'object' &&
          result.result.navigate === true &&
          typeof result.result.route === 'string'
            ? resolveCopiNavigateRoute(
                result.result.route,
                (result.result.params as Record<string, unknown> | undefined) ?? {},
              )
            : null;
        const sentBody =
          result.result &&
          typeof result.result === 'object' &&
          typeof result.result.body === 'string'
            ? result.result.body.trim()
            : '';

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            body: navigate
              ? `Listo. Te llevo a esa pantalla.`
              : sentBody
                ? `Listo. Envié al cliente por WhatsApp:\n\n«${sentBody}»`
                : `Listo. Acción confirmada (${result.status}).`,
            createdAt: answeredAt,
            id: `assistant:action:${answeredAt}`,
            role: 'assistant',
          },
        ]);

        if (navigate) {
          router.push(navigate as never);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('No se pudo confirmar la acción', message);
      }
    },
    [params.businessCenterId, params.organizationId, router],
  );

  const askQuestion = useCallback(
    async (questionOverride?: string, options?: { imageContext?: string }): Promise<void> => {
      if (!params.organizationId) {
        return;
      }

      const question = (questionOverride ?? inputValue).trim();
      if (!question) {
        return;
      }

      const askedAt = new Date().toISOString();
      askInFlightRef.current = true;
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
          imageContext: options?.imageContext,
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

        // Sync from server so the owner↔Copi exchange persists with real ids.
        try {
          const active = await getActiveCopiSession({
            businessCenterId: params.businessCenterId,
            organizationId: params.organizationId,
          });
          applyHistory(active.sessionId, mapHistoryMessages(active.messages));
        } catch {
          // Keep optimistic bubbles if resume fails.
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Copi no respondió', message);
      } finally {
        askInFlightRef.current = false;
        setIsAsking(false);
      }
    },
    [applyHistory, inputValue, params.businessCenterId, params.organizationId, sessionId],
  );

  const hasConversationHistory = messages.some((message) => message.id !== 'starter');

  return {
    confirmProposedAction,
    errorMessage,
    hasConversationHistory,
    inputValue,
    isAsking,
    isLoadingHistory,
    messages,
    policyMessage,
    askQuestion,
    refreshHistory,
    sessionId,
    setInputValue,
  };
}
