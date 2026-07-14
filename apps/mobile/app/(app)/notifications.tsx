import type { ReactElement } from 'react';
import { useRouter } from 'expo-router';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { useOwnerTasks } from '../../src/hooks/useOwnerTasks';
import { productDetailRoute, routes, tasksRoute } from '../../src/navigation/routes';
import { NotificationsScreen } from '../../src/screens/NotificationsScreen';

export default function NotificationsRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const tasksState = useOwnerTasks(organizationId, businessCenterId);

  return (
    <NotificationsScreen
      isLoading={tasksState.isLoading}
      isSaving={tasksState.isSaving}
      notifications={tasksState.notifications}
      onDismissAll={tasksState.dismissAllNotifications}
      onDismissNotification={tasksState.dismissNotification}
      onOpenAlertProduct={(productId) => router.push(productDetailRoute(productId, 'tasks-portal'))}
      onOpenTasks={() => router.push(tasksRoute('follow_up'))}
    />
  );
}
