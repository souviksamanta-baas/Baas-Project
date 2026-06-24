import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, type ReactElement } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useConversationThread } from '../../../src/hooks/useConversationThread';
import { useInbox } from '../../../src/hooks/useInbox';
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
  const inbox = useInbox(organizationId, businessCenterId);
  const thread = useConversationThread({
    businessCenterId,
    conversationId: conversationId ?? null,
    organizationId,
  });

  const conversation = useMemo(
    () => inbox.conversations.find((item) => item.id === conversationId) ?? null,
    [conversationId, inbox.conversations],
  );

  if (!conversation) {
    return (
      <ConversationDetailScreen
        customerName="Conversación"
        isLoading={inbox.isLoading || thread.isLoading}
        messages={thread.messages}
        onBack={() => router.replace(routes.appInbox)}
        statusLabel={undefined}
      />
    );
  }

  return (
    <ConversationDetailScreen
      customerName={conversationDisplayName(conversation)}
      isLoading={thread.isLoading}
      messages={thread.messages}
      onBack={() => router.replace(routes.appInbox)}
      statusLabel={leadStatusLabel(conversation.contact.leadStatus)}
      threadAvatar={conversationAvatarLabel(conversation)}
    />
  );
}
