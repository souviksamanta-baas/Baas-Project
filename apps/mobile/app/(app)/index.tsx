import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AppTab } from '../../src/components/ui';
import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { useInbox } from '../../src/hooks/useInbox';
import { useOwnerTasks } from '../../src/hooks/useOwnerTasks';
import { resolveOwnerGreetingName } from '../../src/lib/ownerGreeting';
import { supabase } from '../../src/lib/supabase';
import {
  conversationRoute,
  manageStockRoute,
  productDetailRoute,
  routes,
  tabRoute,
  taskDetailRoute,
  tasksRoute,
} from '../../src/navigation/routes';
import { HomeScreen } from '../../src/screens/HomeScreen';

export default function HomeRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const inbox = useInbox(organizationId, businessCenterId);
  const tasksState = useOwnerTasks(organizationId, businessCenterId);
  const [greetingName, setGreetingName] = useState('');

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setGreetingName(resolveOwnerGreetingName(data.user?.user_metadata));
    });
  }, []);

  const ownerName = useMemo(() => {
    if (!greetingName) {
      return 'Hola!';
    }

    return `Hola ${greetingName}!`;
  }, [greetingName]);

  return (
    <View style={styles.root}>
      <HomeScreen
        conversations={inbox.conversations}
        metrics={dashboard?.metrics ?? null}
        notifications={tasksState.notifications}
        onOpenAlertProduct={(productId) => router.push(productDetailRoute(productId, 'home'))}
        onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))}
        onOpenLowStock={() => router.push(manageStockRoute({ lowStock: true }))}
        onOpenManageStock={() => router.push(routes.inventoryManageStock)}
        onOpenNotifications={() => router.push(routes.notifications)}
        onOpenTaskDetail={(taskId) => router.push(taskDetailRoute(taskId, 'home'))}
        onOpenTasks={() => router.push(tasksRoute())}
        onOpenWhatsAppSetup={() => router.push(routes.whatsappConnect)}
        onSelectTab={(tab: AppTab) => router.replace(tabRoute(tab))}
        ownerGreeting={ownerName}
        tasks={tasksState.tasks}
        whatsappConnection={dashboard?.whatsappConnection ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
});
