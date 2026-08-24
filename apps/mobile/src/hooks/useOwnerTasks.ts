import { useOwnerTasks as useOwnerTasksFromProvider } from '../context/OwnerTasksProvider';
import type { OwnerTasksState } from './useOwnerTasksState';

export type { OwnerTasksState };

/** Shared owner tasks/notifications from OwnerTasksProvider. */
export function useOwnerTasks(
  _organizationId?: string | null,
  _businessCenterId?: string | null,
): OwnerTasksState {
  return useOwnerTasksFromProvider();
}
