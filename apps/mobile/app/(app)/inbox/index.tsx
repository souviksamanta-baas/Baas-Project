import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { conversationRoute } from '../../../src/navigation/routes';
import { InboxScreen } from '../../../src/screens/InboxScreen';

export default function InboxRoute(): ReactElement {
  const router = useRouter();

  return <InboxScreen onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))} />;
}
