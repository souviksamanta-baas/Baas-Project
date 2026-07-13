import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import type { AppTab } from '../../src/components/ui';
import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { useInbox } from '../../src/hooks/useInbox';
import { conversationRoute, routes, tabRoute } from '../../src/navigation/routes';
import { HomeScreen } from '../../src/screens/HomeScreen';

export default function HomeRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const inbox = useInbox(organizationId, businessCenterId);

  const ownerName = useMemo(() => {
    const organizationName = dashboard?.organization?.name?.trim();
    if (!organizationName) {
      return 'Hola!';
    }

    return `Hola ${organizationName.split(' ')[0]}!`;
  }, [dashboard?.organization?.name]);

  return (
    <HomeScreen
      conversations={inbox.conversations}
      metrics={dashboard?.metrics ?? null}
      onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))}
      onOpenCopiChat={() => router.push(routes.appCopiChat)}
      onOpenManageStock={() => router.push(routes.inventoryManageStock)}
      onOpenNotifications={() => router.push(routes.notifications)}
      onOpenTasks={() => router.push(routes.tasks)}
      onOpenWhatsAppSetup={() => router.push(routes.whatsappConnect)}
      onSelectTab={(tab: AppTab) => router.replace(tabRoute(tab))}
      ownerGreeting={ownerName}
      whatsappConnection={dashboard?.whatsappConnection ?? null}
    />
  );
}
