import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import {
  useConversationThread,
  useInboxConversation,
} from '../../../src/hooks/useConversationThread';
import {
  conversationAvatarLabel,
  conversationDisplayName,
  leadStatusLabel,
} from '../../../src/lib/inboxPresentation';
import { routes } from '../../../src/navigation/routes';
import { ConversationDetailScreen } from '../../../src/screens/InboxScreen';

export default function ConversationDetailRoute(): ReactElement {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const { conversation, isLoading: isLoadingConversation } = useInboxConversation({
    businessCenterId,
    conversationId: conversationId ?? null,
    organizationId,
  });
  const thread = useConversationThread({
    channel: conversation?.channel ?? null,
    businessCenterId,
    conversationId: conversationId ?? null,
    organizationId,
  });

  const canSendReply = Boolean(
    organizationId && businessCenterId && conversationId && !thread.composerBlockedMessage,
  );

  if (!conversation) {
    return (
      <ConversationDetailScreen
        composerBlockedMessage={thread.composerBlockedMessage}
        customerName="Conversación"
        isLoading={isLoadingConversation || thread.isLoading}
        messages={thread.messages}
        onBack={() => router.replace(routes.appInbox)}
        onSendImage={canSendReply ? thread.sendImageReply : undefined}
        onSendReply={canSendReply ? thread.sendReply : undefined}
        statusLabel={undefined}
      />
    );
  }

  return (
    <ConversationDetailScreen
      channel={conversation.channel}
      composerBlockedMessage={thread.composerBlockedMessage}
      customerName={conversationDisplayName(conversation)}
      displayPhoneNumber={dashboard?.whatsappConnection?.displayPhoneNumber ?? null}
      isLoading={thread.isLoading}
      messages={thread.messages}
      onBack={() => router.replace(routes.appInbox)}
      onSendImage={canSendReply ? thread.sendImageReply : undefined}
      onSendReply={canSendReply ? thread.sendReply : undefined}
      statusLabel={leadStatusLabel(conversation.contact.leadStatus)}
      threadAvatar={conversationAvatarLabel(conversation)}
    />
  );
}
