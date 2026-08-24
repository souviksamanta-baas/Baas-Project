import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

import { ensureAndroidNotificationChannels } from '../lib/androidNotificationChannels';
import { showPermissionDeniedAlert } from '../lib/androidPermissions';
import { getEasProjectId } from '../lib/easProject';

import {
  cancelOwnerTask,
  completeOwnerTask,
  createAppointmentFromOwnerTask,
  createOwnerTask,
  dismissAllOwnerNotifications,
  dismissOwnerNotification,
  followOwnerTask,
  getOwnerNotifications,
  getOwnerTasks,
  postponeOwnerTask,
  reassignOwnerTask,
  registerOwnerPushToken,
  snoozeOwnerTaskReminder,
  startOwnerTask,
  subscribeToOwnerTaskChanges,
  unfollowOwnerTask,
  type CreateOwnerTaskInput,
} from '../api/tasks';
import {
  listOrganizationMembers,
  type OrganizationMember,
} from '../api/accountLifecycle';
import { supabase } from '../lib/supabase';
import type { OwnerNotification, OwnerTask } from '../types/tasks';

export interface OwnerTasksState {
  cancelTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  createAppointmentFromTask: (
    taskId: string,
    startsAt: Date,
    options?: { notes?: string | null; title?: string },
  ) => Promise<{ appointmentId: string } | null>;
  createTask: (input: Omit<CreateOwnerTaskInput, 'businessCenterId' | 'organizationId'>) => Promise<
    OwnerTask | null
  >;
  currentUserId: string | null;
  dismissAllNotifications: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  enablePushNotifications: () => Promise<void>;
  errorMessage: string | null;
  followTask: (taskId: string) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  members: OrganizationMember[];
  notifications: OwnerNotification[];
  postponeTask: (taskId: string, postponedUntil: Date) => Promise<void>;
  pushRegistrationStatus: string | null;
  reassignTask: (taskId: string, assignedToUserId: string) => Promise<void>;
  refresh: () => Promise<void>;
  /** @deprecated Alias kept for legacy callers. Uses default 24h postpone. */
  snoozeTask: (taskId: string) => Promise<void>;
  snoozeReminder: (taskId: string, minutes?: number) => Promise<void>;
  startTask: (taskId: string) => Promise<void>;
  tasks: OwnerTask[];
  unfollowTask: (taskId: string) => Promise<void>;
}

export function useOwnerTasks(
  organizationId: string | null,
  businessCenterId: string | null,
): OwnerTasksState {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [pushRegistrationStatus, setPushRegistrationStatus] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OwnerTask[]>([]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setCurrentUserId(data.user?.id ?? null);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setMembers([]);
      return;
    }

    let mounted = true;
    void listOrganizationMembers(organizationId)
      .then((rows) => {
        if (mounted) {
          setMembers(rows);
        }
      })
      .catch(() => {
        if (mounted) {
          setMembers([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [organizationId]);

  const loadTasks = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      setNotifications([]);
      setTasks([]);
      return;
    }

    const [nextTasks, nextNotifications] = await Promise.all([
      getOwnerTasks({
        businessCenterId,
        currentUserId,
        organizationId,
      }),
      getOwnerNotifications(organizationId, businessCenterId),
    ]);
    setTasks(nextTasks);
    setNotifications(nextNotifications);
  }, [businessCenterId, currentUserId, organizationId]);

  useEffect(() => {
    if (!organizationId || !businessCenterId) {
      setNotifications([]);
      setTasks([]);
      return undefined;
    }

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    loadTasks()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('No se pudieron cargar las tareas', message);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeToOwnerTaskChanges(organizationId, businessCenterId, {
      onNotificationInsert: (notification) => {
        Alert.alert(notification.title, notification.body);
      },
      onRefresh: () => {
        void loadTasks();
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [businessCenterId, loadTasks, organizationId]);

  // Merge assignee display names in-memory whenever members or tasks change.
  const tasksWithLabels = useMemo(() => {
    const assigneeMap = buildAssigneeMap(members);
    return tasks.map((task) => ({
      ...task,
      assigneeLabel: task.assignedToUserId
        ? assigneeMap.get(task.assignedToUserId) ?? task.assigneeLabel
        : task.assigneeLabel,
    }));
  }, [members, tasks]);

  const runAction = useCallback(
    async (params: {
      action: () => Promise<void>;
      failureTitle: string;
      optimistic?: () => (() => void) | undefined;
    }): Promise<void> => {
      setIsSaving(true);
      setErrorMessage(null);

      const rollback = params.optimistic?.();

      try {
        await params.action();
        await loadTasks();
      } catch (error) {
        rollback?.();
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
        Alert.alert(params.failureTitle, message);
      } finally {
        setIsSaving(false);
      }
    },
    [loadTasks],
  );

  const completeTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }

      await runAction({
        action: async () => {
          await completeOwnerTask({ businessCenterId, organizationId, taskId });
        },
        failureTitle: 'No se pudo completar',
        optimistic: () => {
          const snapshot = tasks;
          setTasks((current) => current.filter((task) => task.id !== taskId));
          return () => setTasks(snapshot);
        },
      });
    },
    [businessCenterId, organizationId, runAction, tasks],
  );

  const startTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }
      await runAction({
        action: async () => {
          await startOwnerTask({ businessCenterId, organizationId, taskId });
        },
        failureTitle: 'No se pudo marcar en curso',
        optimistic: () => {
          const snapshot = tasks;
          setTasks((current) =>
            current.map((task) =>
              task.id === taskId ? { ...task, status: 'in_progress' as const } : task,
            ),
          );
          return () => setTasks(snapshot);
        },
      });
    },
    [businessCenterId, organizationId, runAction, tasks],
  );

  const cancelTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }
      await runAction({
        action: async () => {
          await cancelOwnerTask({ businessCenterId, organizationId, taskId });
        },
        failureTitle: 'No se pudo cancelar',
        optimistic: () => {
          const snapshot = tasks;
          setTasks((current) => current.filter((task) => task.id !== taskId));
          return () => setTasks(snapshot);
        },
      });
    },
    [businessCenterId, organizationId, runAction, tasks],
  );

  const postponeTask = useCallback(
    async (taskId: string, postponedUntil: Date): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }
      await runAction({
        action: async () => {
          await postponeOwnerTask({
            businessCenterId,
            organizationId,
            postponedUntil,
            taskId,
          });
        },
        failureTitle: 'No se pudo posponer',
        optimistic: () => {
          const snapshot = tasks;
          const iso = postponedUntil.toISOString();
          setTasks((current) =>
            current.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    dueAt: iso,
                    postponedUntil: iso,
                    status: 'postponed' as const,
                  }
                : task,
            ),
          );
          return () => setTasks(snapshot);
        },
      });
    },
    [businessCenterId, organizationId, runAction, tasks],
  );

  const snoozeReminder = useCallback(
    async (taskId: string, minutes = 10): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }
      await runAction({
        action: async () => {
          await snoozeOwnerTaskReminder({
            businessCenterId,
            minutes,
            organizationId,
            taskId,
          });
        },
        failureTitle: 'No se pudo silenciar el recordatorio',
      });
    },
    [businessCenterId, organizationId, runAction],
  );

  const reassignTask = useCallback(
    async (taskId: string, assignedToUserId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }
      await runAction({
        action: async () => {
          await reassignOwnerTask({
            assignedToUserId,
            businessCenterId,
            organizationId,
            taskId,
          });
        },
        failureTitle: 'No se pudo reasignar',
      });
    },
    [businessCenterId, organizationId, runAction],
  );

  const followTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }
      await runAction({
        action: async () => {
          await followOwnerTask({ businessCenterId, organizationId, taskId });
        },
        failureTitle: 'No se pudo seguir la tarea',
        optimistic: () => {
          const snapshot = tasks;
          setTasks((current) =>
            current.map((task) =>
              task.id === taskId ? { ...task, isFollowing: true } : task,
            ),
          );
          return () => setTasks(snapshot);
        },
      });
    },
    [businessCenterId, organizationId, runAction, tasks],
  );

  const unfollowTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }
      await runAction({
        action: async () => {
          await unfollowOwnerTask({ organizationId, taskId });
        },
        failureTitle: 'No se pudo dejar de seguir',
        optimistic: () => {
          const snapshot = tasks;
          setTasks((current) =>
            current.map((task) =>
              task.id === taskId ? { ...task, isFollowing: false } : task,
            ),
          );
          return () => setTasks(snapshot);
        },
      });
    },
    [businessCenterId, organizationId, runAction, tasks],
  );

  const createAppointmentFromTaskHandler = useCallback(
    async (
      taskId: string,
      startsAt: Date,
      options?: { notes?: string | null; title?: string },
    ): Promise<{ appointmentId: string } | null> => {
      if (!organizationId || !businessCenterId) {
        return null;
      }

      setIsSaving(true);
      setErrorMessage(null);

      try {
        const result = await createAppointmentFromOwnerTask({
          businessCenterId,
          notes: options?.notes ?? null,
          organizationId,
          startsAt: startsAt.toISOString(),
          taskId,
          title: options?.title,
        });
        await loadTasks();
        return { appointmentId: result.appointmentId };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
        Alert.alert('No se pudo crear la reunión', message);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [businessCenterId, loadTasks, organizationId],
  );

  const createTaskHandler = useCallback(
    async (
      input: Omit<CreateOwnerTaskInput, 'businessCenterId' | 'organizationId'>,
    ): Promise<OwnerTask | null> => {
      if (!organizationId || !businessCenterId) {
        return null;
      }

      setIsSaving(true);
      setErrorMessage(null);

      try {
        const task = await createOwnerTask({
          ...input,
          businessCenterId,
          organizationId,
        });
        await loadTasks();
        return task;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
        Alert.alert('No se pudo crear la tarea', message);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [businessCenterId, loadTasks, organizationId],
  );

  const snoozeTaskLegacy = useCallback(
    async (taskId: string): Promise<void> => {
      const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await postponeTask(taskId, nextDay);
    },
    [postponeTask],
  );

  const dismissNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }

      const previous = notifications;
      setNotifications((current) => current.filter((item) => item.id !== notificationId));

      setIsSaving(true);
      setErrorMessage(null);
      try {
        await dismissOwnerNotification(organizationId, businessCenterId, notificationId);
        await loadTasks();
      } catch (error) {
        setNotifications(previous);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
        Alert.alert('No se pudo descartar', message);
      } finally {
        setIsSaving(false);
      }
    },
    [businessCenterId, loadTasks, notifications, organizationId],
  );

  const dismissAllNotifications = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      return;
    }

    const previous = notifications;
    setNotifications([]);

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await dismissAllOwnerNotifications(organizationId, businessCenterId);
      await loadTasks();
    } catch (error) {
      setNotifications(previous);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(message);
      Alert.alert('No se pudieron descartar las alertas', message);
    } finally {
      setIsSaving(false);
    }
  }, [businessCenterId, loadTasks, notifications, organizationId]);

  const enablePushNotifications = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await ensureAndroidNotificationChannels();

      const permissions = await Notifications.getPermissionsAsync();
      const finalPermissions = permissions.granted
        ? permissions
        : await Notifications.requestPermissionsAsync();

      if (!finalPermissions.granted) {
        showPermissionDeniedAlert('notifications', {
          canAskAgain: finalPermissions.canAskAgain !== false,
        });
        setPushRegistrationStatus('No se otorgó el permiso de notificaciones.');
        return;
      }

      const projectId = getEasProjectId();
      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      await registerOwnerPushToken(organizationId, businessCenterId, token.data);
      setPushRegistrationStatus('Las alertas push están activas en este dispositivo.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown push registration error';
      setErrorMessage(message);
      setPushRegistrationStatus('Push registration failed on this device.');
      Alert.alert('Could not enable push alerts', message);
    } finally {
      setIsSaving(false);
    }
  }, [businessCenterId, organizationId]);

  return {
    cancelTask,
    completeTask,
    createAppointmentFromTask: createAppointmentFromTaskHandler,
    createTask: createTaskHandler,
    currentUserId,
    dismissAllNotifications,
    dismissNotification,
    enablePushNotifications,
    errorMessage,
    followTask,
    isLoading,
    isSaving,
    members,
    notifications,
    postponeTask,
    pushRegistrationStatus,
    reassignTask,
    refresh: loadTasks,
    snoozeReminder,
    snoozeTask: snoozeTaskLegacy,
    startTask,
    tasks: tasksWithLabels,
    unfollowTask,
  };
}

function buildAssigneeMap(members: OrganizationMember[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    map.set(member.userId, member.displayName);
  }
  return map;
}
