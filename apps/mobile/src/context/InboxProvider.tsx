import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';

import { getInboxConversations, subscribeToInboxChanges } from '../api/conversations';
import { useOwnerSessionContext } from './OwnerSessionProvider';
import type { InboxConversationSummary } from '../types/messages';

export interface InboxState {
  conversations: InboxConversationSummary[];
  errorMessage: string | null;
  isLoading: boolean;
  reloadConversations: () => Promise<void>;
}

const InboxContext = createContext<InboxState | null>(null);

const REALTIME_DEBOUNCE_MS = 400;

export function InboxProvider(props: { children: ReactNode }): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;

  const [conversations, setConversations] = useState<InboxConversationSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  const loadConversationsImmediate = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      setConversations([]);
      return;
    }

    const nextConversations = await getInboxConversations(organizationId, businessCenterId);
    setConversations(nextConversations);
  }, [businessCenterId, organizationId]);

  const scheduleLoadConversations = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void loadConversationsImmediate().catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
      });
    }, REALTIME_DEBOUNCE_MS);
  }, [loadConversationsImmediate]);

  const reloadConversations = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      setConversations([]);
      return;
    }

    await loadConversationsImmediate();
  }, [businessCenterId, loadConversationsImmediate, organizationId]);

  useEffect(() => {
    if (!organizationId || !businessCenterId) {
      setConversations([]);
      setErrorMessage(null);
      hasLoadedRef.current = false;
      return undefined;
    }

    let mounted = true;
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    setErrorMessage(null);

    loadConversationsImmediate()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (mounted) {
          setErrorMessage(message);
          Alert.alert('Could not load inbox', message);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
          hasLoadedRef.current = true;
        }
      });

    const unsubscribe = subscribeToInboxChanges(organizationId, businessCenterId, {
      onConversationChange: scheduleLoadConversations,
      onMessage: scheduleLoadConversations,
    });

    return () => {
      mounted = false;
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [businessCenterId, loadConversationsImmediate, organizationId, scheduleLoadConversations]);

  const value: InboxState = {
    conversations,
    errorMessage,
    isLoading,
    reloadConversations,
  };

  return <InboxContext.Provider value={value}>{props.children}</InboxContext.Provider>;
}

export function useInboxContext(): InboxState {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInboxContext must be used within InboxProvider');
  }

  return context;
}
