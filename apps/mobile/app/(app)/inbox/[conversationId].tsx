import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, type ReactElement } from 'react';

import { conversations } from '../../../src/api/mockData';
import { ConversationDetailScreen } from '../../../src/screens/InboxScreen';
import { routes } from '../../../src/navigation/routes';

export default function ConversationDetailRoute(): ReactElement {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();

  const conversation = useMemo(
    () => conversations.find((item) => item.id === conversationId) ?? conversations[0],
    [conversationId],
  );

  return (
    <ConversationDetailScreen conversation={conversation} onBack={() => router.replace(routes.appInbox)} />
  );
}
