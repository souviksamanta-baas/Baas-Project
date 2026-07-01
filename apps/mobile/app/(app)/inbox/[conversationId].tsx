import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useConversationThread } from '../../../src/hooks/useConversationThread';
import {
  conversationAvatarLabel,
  conversationDisplayName,
  leadStatusLabel,
} from '../../../src/lib/inboxPresentation';
import { routes } from '../../../src/navigation/routes';
import { getInboxConversations } from '../../../src/services/messages';
import { sendConversationReply } from '../../../src/services/whatsapp';
import { ConversationDetailScreen } from '../../../src/screens/InboxScreen';
import type { InboxConversationSummary } from '../../../src/types/messages';

export default function ConversationDetailRoute(): ReactElement {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [conversation, setConversation] = useState<InboxConversationSummary | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const thread = useConversationThread({
    businessCenterId,
    conversationId: conversationId ?? null,
    organizationId,
  });

  useEffect(() => {
    if (!organizationId || !businessCenterId || !conversationId) {
      setConversation(null);
      return;
    }

    let mounted = true;
    setIsLoadingConversation(true);

    getInboxConversations(organizationId, businessCenterId)
      .then((conversations) => {
        if (mounted) {
          setConversation(conversations.find((item) => item.id === conversationId) ?? null);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingConversation(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [businessCenterId, conversationId, organizationId]);

  const canSendReply = Boolean(organizationId && businessCenterId && conversationId);

  if (!conversation) {
    return (
      <ConversationDetailScreen
        customerName="Conversación"
        isLoading={isLoadingConversation || thread.isLoading}
        messages={thread.messages}
        onBack={() => router.replace(routes.appInbox)}
        onSendReply={
          canSendReply
            ? async (body) => {
                await sendConversationReply({
                  body,
                  businessCenterId: businessCenterId!,
                  conversationId: conversationId!,
                  organizationId: organizationId!,
                });
              }
            : undefined
        }
        statusLabel={undefined}
      />
    );
  }

  return (
    <ConversationDetailScreen
      customerName={conversationDisplayName(conversation)}
      displayPhoneNumber={dashboard?.whatsappConnection?.displayPhoneNumber ?? null}
      isLoading={thread.isLoading}
      messages={thread.messages}
      onBack={() => router.replace(routes.appInbox)}
      onSendReply={
        canSendReply
          ? async (body) => {
              await sendConversationReply({
                body,
                businessCenterId: businessCenterId!,
                conversationId: conversationId!,
                organizationId: organizationId!,
              });
            }
          : undefined
      }
      statusLabel={leadStatusLabel(conversation.contact.leadStatus)}
      threadAvatar={conversationAvatarLabel(conversation)}
    />
  );
}
