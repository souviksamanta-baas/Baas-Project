import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getOwnerTask } from '../../../src/api/tasks';
import { ScreenContent } from '../../../src/components/ui';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerTasks } from '../../../src/hooks/useOwnerTasks';
import {
  conversationRoute,
  parseTaskReturnTo,
  presupuestoDetailRoute,
  resolveTaskReturnRoute,
} from '../../../src/navigation/routes';
import { TaskDetailScreen } from '../../../src/screens/TaskDetailScreen';
import type { OwnerTask } from '../../../src/types/tasks';
import { colors } from '../../../src/theme';

export default function TaskDetailRoute(): ReactElement {
  const router = useRouter();
  const { taskId: rawTaskId, returnTo: rawReturnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
    taskId: string;
  }>();
  const returnTo = parseTaskReturnTo(rawReturnTo);
  const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const tasksState = useOwnerTasks(organizationId, businessCenterId);
  const [task, setTask] = useState<OwnerTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!organizationId || !businessCenterId || !taskId) {
      setTask(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    getOwnerTask({
      businessCenterId,
      currentUserId: tasksState.currentUserId,
      organizationId,
      taskId,
    })
      .then((nextTask) => {
        if (mounted) {
          setTask(nextTask);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [businessCenterId, organizationId, taskId, tasksState.currentUserId, tasksState.tasks]);

  if (isLoading) {
    return (
      <ScreenContent>
        <ActivityIndicator color={colors.primary} />
      </ScreenContent>
    );
  }

  if (!task) {
    return (
      <ScreenContent>
        <Text>No se encontró la tarea.</Text>
      </ScreenContent>
    );
  }

  const goBack = (): void => {
    router.replace(resolveTaskReturnRoute(returnTo));
  };

  return (
    <TaskDetailScreen
      currentUserId={tasksState.currentUserId}
      isSaving={tasksState.isSaving}
      members={tasksState.members}
      onBack={goBack}
      onCancelTask={async () => {
        await tasksState.cancelTask(task.id);
        goBack();
      }}
      onCompleteTask={async () => {
        await tasksState.completeTask(task.id);
        goBack();
      }}
      onCreateAppointment={async (startsAt) => {
        await tasksState.createAppointmentFromTask(task.id, startsAt);
      }}
      onFollowTask={async () => {
        await tasksState.followTask(task.id);
      }}
      onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))}
      onOpenPresupuesto={(quoteId) =>
        router.push(presupuestoDetailRoute(quoteId, 'tasks-portal'))
      }
      onPostponeTask={async (postponedUntil) => {
        await tasksState.postponeTask(task.id, postponedUntil);
      }}
      onReassignTask={async (userId) => {
        await tasksState.reassignTask(task.id, userId);
      }}
      onSnoozeReminder={async (minutes) => {
        await tasksState.snoozeReminder(task.id, minutes);
      }}
      onStartTask={async () => {
        await tasksState.startTask(task.id);
      }}
      onUnfollowTask={async () => {
        await tasksState.unfollowTask(task.id);
      }}
      role={dashboard?.organization?.role}
      task={
        tasksState.tasks.find((item) => item.id === task.id) ?? task
      }
    />
  );
}
