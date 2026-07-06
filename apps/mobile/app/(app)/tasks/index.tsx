import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerTasks } from '../../../src/hooks/useOwnerTasks';
import { TasksScreen } from '../../../src/screens/TasksScreen';

export default function TasksRoute(): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const tasksState = useOwnerTasks(organizationId, businessCenterId);

  return (
    <TasksScreen
      businessCenterId={businessCenterId}
      isLoading={tasksState.isLoading}
      onCompleteTask={tasksState.completeTask}
      onSnoozeTask={tasksState.snoozeTask}
      organizationId={organizationId}
      tasks={tasksState.tasks}
    />
  );
}
