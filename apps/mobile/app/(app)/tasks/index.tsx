import type { ReactElement } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerTasks } from '../../../src/hooks/useOwnerTasks';
import {
  conversationRoute,
  parseWorkQueueFilter,
  productDetailRoute,
  routes,
  taskDetailRoute,
} from '../../../src/navigation/routes';
import { TasksScreen } from '../../../src/screens/TasksScreen';

export default function TasksRoute(): ReactElement {
  const router = useRouter();
  const { filter: rawFilter } = useLocalSearchParams<{ filter?: string | string[] }>();
  const initialFilter = parseWorkQueueFilter(rawFilter);
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const tasksState = useOwnerTasks(organizationId, businessCenterId);

  return (
    <TasksScreen
      initialFilter={initialFilter}
      isLoading={tasksState.isLoading}
      isSaving={tasksState.isSaving}
      notifications={tasksState.notifications}
      onCompleteTask={tasksState.completeTask}
      onDismissAlert={tasksState.dismissNotification}
      onOpenAlertProduct={(productId) =>
        router.push(productDetailRoute(productId, 'tasks-portal'))
      }
      onOpenCopi={() => router.push(routes.appCopiChat)}
      onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))}
      onOpenTaskDetail={(taskId) => router.push(taskDetailRoute(taskId, 'tasks-portal'))}
      onSnoozeTask={tasksState.snoozeTask}
      tasks={tasksState.tasks}
    />
  );
}
