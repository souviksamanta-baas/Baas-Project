import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { HomeScreen } from '../../src/screens/HomeScreen';
import { conversationRoute, routes, tabRoute } from '../../src/navigation/routes';
import type { AppTab } from '../../src/components/ui';

export default function HomeRoute(): ReactElement {
  const router = useRouter();

  return (
    <HomeScreen
      onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))}
      onOpenManageStock={() => router.push(routes.inventoryManageStock)}
      onOpenNotifications={() => router.push(routes.notifications)}
      onSelectTab={(tab: AppTab) => router.replace(tabRoute(tab))}
    />
  );
}
