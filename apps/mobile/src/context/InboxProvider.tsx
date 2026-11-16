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

const INBOX_PAGE_SIZE = 30;

export interface InboxState {
  conversations: InboxConversationSummary[];
  errorMessage: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
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
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const loadConversationsImmediate = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      setConversations([]);
      setHasMore(false);
      return;
    }

    const loadedCount = Math.max(conversationsRef.current.length, INBOX_PAGE_SIZE);
    const nextConversations = await getInboxConversations(organizationId, businessCenterId, {
      limit: loadedCount,
    });
    setConversations(nextConversations);
    setHasMore(nextConversations.length >= loadedCount);
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

  const loadMore = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const page = await getInboxConversations(organizationId, businessCenterId, {
        limit: INBOX_PAGE_SIZE,
        offset: conversationsRef.current.length,
      });
      setConversations((current) => {
        const seen = new Set(current.map((conversation) => conversation.id));
        return [...current, ...page.filter((conversation) => !seen.has(conversation.id))];
      });
      setHasMore(page.length >= INBOX_PAGE_SIZE);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [businessCenterId, hasMore, isLoadingMore, organizationId]);

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
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
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
