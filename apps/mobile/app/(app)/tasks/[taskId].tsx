import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
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

  const [fetchedTask, setFetchedTask] = useState<OwnerTask | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Instant when opening from the list. Never put `tasksState.tasks` in the fetch
  // effect deps — a fresh array each render used to keep this page on the spinner.
  const taskFromList = taskId
    ? (tasksState.tasks.find((item) => item.id === taskId) ?? null)
    : null;
  const task = taskFromList ?? fetchedTask;

  useEffect(() => {
    if (!organizationId || !businessCenterId || !taskId) {
      setFetchedTask(null);
      setIsFetching(false);
      return;
    }

    let mounted = true;
    setIsFetching(true);

    getOwnerTask({
      businessCenterId,
      currentUserId: tasksState.currentUserId,
      organizationId,
      taskId,
    })
      .then((nextTask) => {
        if (mounted) {
          setFetchedTask(nextTask);
        }
      })
      .catch(() => {
        if (mounted) {
          setFetchedTask(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsFetching(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [businessCenterId, organizationId, taskId, tasksState.currentUserId]);

  const goBack = (): void => {
    router.replace(resolveTaskReturnRoute(returnTo));
  };

  if (!taskId) {
    return (
      <ScreenContent>
        <Text style={styles.message}>No se encontró la tarea.</Text>
        <Pressable onPress={goBack}>
          <Text style={styles.link}>Volver</Text>
        </Pressable>
      </ScreenContent>
    );
  }

  if (!task && isFetching) {
    return (
      <ScreenContent>
        <ActivityIndicator color={colors.primary} />
      </ScreenContent>
    );
  }

  if (!task) {
    return (
      <ScreenContent>
        <Text style={styles.message}>No se encontró la tarea.</Text>
        <Pressable onPress={goBack}>
          <Text style={styles.link}>Volver</Text>
        </Pressable>
      </ScreenContent>
    );
  }

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
      task={task}
    />
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  message: {
    color: colors.slate,
    fontSize: 15,
  },
});
