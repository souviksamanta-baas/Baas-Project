import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from 'react';

import { useOwnerSessionContext } from './OwnerSessionProvider';
import {
  useOwnerTasksState,
  type OwnerTasksState,
} from '../hooks/useOwnerTasksState';

const OwnerTasksContext = createContext<OwnerTasksState | null>(null);

export function OwnerTasksProvider(props: { children: ReactNode }): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const state = useOwnerTasksState(organizationId, businessCenterId);

  return (
    <OwnerTasksContext.Provider value={state}>{props.children}</OwnerTasksContext.Provider>
  );
}

export function useOwnerTasksContext(): OwnerTasksState {
  const context = useContext(OwnerTasksContext);
  if (!context) {
    throw new Error('useOwnerTasks must be used within OwnerTasksProvider');
  }
  return context;
}

/** Shared owner tasks/notifications from OwnerTasksProvider. */
export function useOwnerTasks(
  _organizationId?: string | null,
  _businessCenterId?: string | null,
): OwnerTasksState {
  return useOwnerTasksContext();
}

export type { OwnerTasksState };
