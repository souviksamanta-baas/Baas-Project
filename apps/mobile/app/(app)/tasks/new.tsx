import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerTasks } from '../../../src/hooks/useOwnerTasks';
import { routes } from '../../../src/navigation/routes';
import { NewTaskScreen } from '../../../src/screens/NewTaskScreen';

export default function NewTaskRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const tasksState = useOwnerTasks(organizationId, businessCenterId);

  return (
    <NewTaskScreen
      currentUserId={tasksState.currentUserId}
      isSaving={tasksState.isSaving}
      members={tasksState.members}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace(routes.tasks);
      }}
      onCreate={async (input) => {
        const created = await tasksState.createTask({
          assignedToUserId: input.assignedToUserId,
          description: input.description,
          dueAt: input.dueAt.toISOString(),
          title: input.title,
        });
        if (!created) {
          Alert.alert(
            'No se pudo crear la tarea',
            tasksState.errorMessage ?? 'Intentá de nuevo en unos segundos.',
          );
          return;
        }
        router.replace(routes.tasks);
      }}
    />
  );
}
