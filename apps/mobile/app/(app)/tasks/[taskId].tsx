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

    getOwnerTask(organizationId, businessCenterId, taskId)
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
  }, [businessCenterId, organizationId, taskId]);

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
        <Text>No se encontro la tarea.</Text>
      </ScreenContent>
    );
  }

  return (
    <TaskDetailScreen
      isSaving={tasksState.isSaving}
      onBack={() => router.replace(resolveTaskReturnRoute(returnTo))}
      onCompleteTask={async () => {
        await tasksState.completeTask(task.id);
        router.replace(resolveTaskReturnRoute(returnTo));
      }}
      onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))}
      onSnoozeTask={async () => {
        await tasksState.snoozeTask(task.id);
        router.replace(resolveTaskReturnRoute(returnTo));
      }}
      task={task}
    />
  );
}
