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
  taskNewRoute,
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
      actions={{
        onCancelTask: tasksState.cancelTask,
        onCompleteTask: tasksState.completeTask,
        onCreateAppointmentFromTask: async (taskId, startsAt) => {
          await tasksState.createAppointmentFromTask(taskId, startsAt);
        },
        onFollowTask: tasksState.followTask,
        onPostponeTask: tasksState.postponeTask,
        onReassignTask: tasksState.reassignTask,
        onSnoozeReminder: tasksState.snoozeReminder,
        onStartTask: tasksState.startTask,
        onUnfollowTask: tasksState.unfollowTask,
      }}
      currentUserId={tasksState.currentUserId}
      initialFilter={initialFilter}
      isLoading={tasksState.isLoading}
      isSaving={tasksState.isSaving}
      members={tasksState.members}
      notifications={tasksState.notifications}
      onDismissAlert={tasksState.dismissNotification}
      onOpenAlertProduct={(productId) =>
        router.push(productDetailRoute(productId, 'tasks-portal'))
      }
      onOpenCopi={() => router.push(routes.appCopiChat)}
      onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))}
      onOpenNewTask={() => router.push(taskNewRoute())}
      onOpenTaskDetail={(taskId) => router.push(taskDetailRoute(taskId, 'tasks-portal'))}
      role={dashboard?.organization?.role}
      tasks={tasksState.tasks}
    />
  );
}
