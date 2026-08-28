import type { ReactElement } from 'react';
import { useRouter } from 'expo-router';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerTasks } from '../../../src/hooks/useOwnerTasks';
import {
  notificationDetailRoute,
  taskDetailRoute,
  tasksRoute,
} from '../../../src/navigation/routes';
import { NotificationsScreen } from '../../../src/screens/NotificationsScreen';

export default function NotificationsRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const tasksState = useOwnerTasks(organizationId, businessCenterId);

  return (
    <NotificationsScreen
      hasMore={tasksState.hasMoreNotifications}
      isLoading={tasksState.isLoading && tasksState.notifications.length === 0}
      isLoadingMore={tasksState.isLoadingMoreNotifications}
      isSaving={tasksState.isSaving}
      notifications={tasksState.notifications}
      onDismissNotification={tasksState.dismissNotification}
      onLoadMore={tasksState.loadMoreNotifications}
      onMarkAllRead={tasksState.markAllNotificationsRead}
      onOpenNotification={(notificationId) => router.push(notificationDetailRoute(notificationId))}
      onOpenTaskDetail={(taskId) => router.push(taskDetailRoute(taskId, 'notifications'))}
      onOpenTasks={() => router.push(tasksRoute())}
      organizationId={organizationId}
    />
  );
}
