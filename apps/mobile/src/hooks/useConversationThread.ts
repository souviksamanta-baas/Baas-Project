import { useCallback, useEffect, useState } from 'react';

import {
  getConversationMessages,
  getInboxConversationById,
  subscribeToConversationMessages,
} from '../api/conversations';
import {
  getInstagramMessagingWindowState,
  instagramWindowComposerCopy,
  sendInstagramReply,
  type InstagramMessagingWindowState,
} from '../api/instagram';
import { sendConversationImage, sendConversationReply } from '../api/whatsapp';
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
  channel?: string | null;
  conversationId: string | null;
  organizationId: string | null;
}): {
  composerBlockedMessage: string | null;
  errorMessage: string | null;
  isLoading: boolean;
  messages: WhatsAppMessagePreview[];
  messagingWindowState: InstagramMessagingWindowState | null;
  sendImageReply: (params: {
    caption?: string;
    imageBase64: string;
    mimeType?: string;
  }) => Promise<void>;
  sendReply: (body: string) => Promise<void>;
} {
  const [messages, setMessages] = useState<WhatsAppMessagePreview[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messagingWindowState, setMessagingWindowState] =
    useState<InstagramMessagingWindowState | null>(null);

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

  useEffect(() => {
    if (params.channel !== 'instagram' || !params.organizationId || !params.conversationId) {
      setMessagingWindowState(null);
      return;
    }

    let mounted = true;
    getInstagramMessagingWindowState({
      conversationId: params.conversationId,
      organizationId: params.organizationId,
    })
      .then((result) => {
        if (mounted) {
          setMessagingWindowState(result.state);
        }
      })
      .catch(() => {
        if (mounted) {
          setMessagingWindowState('reply_available');
        }
      });

    return () => {
      mounted = false;
    };
  }, [params.channel, params.conversationId, params.organizationId, messages.length]);

  const sendReply = useCallback(
    async (body: string): Promise<void> => {
      if (!params.organizationId || !params.businessCenterId || !params.conversationId) {
        throw new Error('Missing conversation context.');
      }

      if (params.channel === 'instagram') {
        await sendInstagramReply({
          body,
          businessCenterId: params.businessCenterId,
          conversationId: params.conversationId,
          organizationId: params.organizationId,
        });
        return;
      }

      await sendConversationReply({
        body,
        businessCenterId: params.businessCenterId,
        conversationId: params.conversationId,
        organizationId: params.organizationId,
      });
    },
    [params.businessCenterId, params.channel, params.conversationId, params.organizationId],
  );

  const sendImageReply = useCallback(
    async (imageParams: {
      caption?: string;
      imageBase64: string;
      mimeType?: string;
    }): Promise<void> => {
      if (!params.organizationId || !params.businessCenterId || !params.conversationId) {
        throw new Error('Missing conversation context.');
      }

      if (params.channel === 'instagram') {
        throw new Error('El envío de imágenes por Instagram llega en una próxima versión.');
      }

      await sendConversationImage({
        body: imageParams.caption,
        businessCenterId: params.businessCenterId,
        conversationId: params.conversationId,
        imageBase64: imageParams.imageBase64,
        mimeType: imageParams.mimeType,
        organizationId: params.organizationId,
      });
    },
    [params.businessCenterId, params.channel, params.conversationId, params.organizationId],
  );

  const windowCopy =
    params.channel === 'instagram' && messagingWindowState
      ? instagramWindowComposerCopy(messagingWindowState)
      : null;

  return {
    composerBlockedMessage: windowCopy?.blocked ? windowCopy.message : null,
    errorMessage,
    isLoading,
    messages,
    messagingWindowState,
    sendImageReply,
    sendReply,
  };
}
