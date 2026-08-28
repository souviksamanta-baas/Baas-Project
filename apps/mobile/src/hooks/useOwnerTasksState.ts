import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

import { ensureAndroidNotificationChannels } from '../lib/androidNotificationChannels';
import { getEasProjectId } from '../lib/easProject';

import {
  cancelOwnerTask,
  completeOwnerTask,
  createAppointmentFromOwnerTask,
  createOwnerTask,
  dismissOwnerNotification,
  followOwnerTask,
  getOwnerNotifications,
  getOwnerTasks,
  markOwnerNotificationRead,
  markOwnerNotificationsRead,
  NOTIFICATIONS_PAGE_SIZE,
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

const REALTIME_DEBOUNCE_MS = 400;

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
  dismissNotification: (notificationId: string) => Promise<void>;
  enablePushNotifications: () => Promise<void>;
  errorMessage: string | null;
  followTask: (taskId: string) => Promise<void>;
  hasMoreNotifications: boolean;
  isLoading: boolean;
  isLoadingMoreNotifications: boolean;
  isSaving: boolean;
  loadMoreNotifications: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  members: OrganizationMember[];
  notifications: OwnerNotification[];
  postponeTask: (taskId: string, postponedUntil: Date) => Promise<void>;
  pushRegistrationStatus: string | null;
  reassignTask: (taskId: string, assignedToUserId: string) => Promise<void>;
  refresh: () => Promise<void>;
  unreadNotificationCount: number;
  /** @deprecated Alias kept for legacy callers. Uses default 24h postpone. */
  snoozeTask: (taskId: string) => Promise<void>;
  snoozeReminder: (taskId: string, minutes?: number) => Promise<void>;
  startTask: (taskId: string) => Promise<void>;
  tasks: OwnerTask[];
  unfollowTask: (taskId: string) => Promise<void>;
}

/**
 * Internal state hook used by OwnerTasksProvider. Prefer `useOwnerTasks()` at
 * call sites so Home / Notificaciones / Tareas share one cached instance.
 */
export function useOwnerTasksState(
  organizationId: string | null,
  businessCenterId: string | null,
): OwnerTasksState {
  const [authReady, setAuthReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [isLoadingMoreNotifications, setIsLoadingMoreNotifications] = useState(false);
  const [pushRegistrationStatus, setPushRegistrationStatus] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OwnerTask[]>([]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) {
        return;
      }
      const userId = data.user?.id ?? null;
      currentUserIdRef.current = userId;
      setCurrentUserId(userId);
      setAuthReady(true);
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
      setHasMoreNotifications(false);
      setTasks([]);
      return;
    }

    const userId = currentUserIdRef.current;

    // Progressive updates: notifications can paint before Nest tasks finish.
    await Promise.all([
      getOwnerTasks({
        businessCenterId,
        currentUserId: userId,
        organizationId,
      }).then((nextTasks) => {
        setTasks(nextTasks);
      }),
      getOwnerNotifications(organizationId, businessCenterId, {
        currentUserId: userId,
        limit: NOTIFICATIONS_PAGE_SIZE,
      }).then((nextNotifications) => {
        setNotifications(nextNotifications);
        setHasMoreNotifications(nextNotifications.length >= NOTIFICATIONS_PAGE_SIZE);
      }),
    ]);
  }, [businessCenterId, organizationId]);

  const scheduleLoadTasks = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void loadTasks().catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
      });
    }, REALTIME_DEBOUNCE_MS);
  }, [loadTasks]);

  useEffect(() => {
    if (!authReady || !organizationId || !businessCenterId) {
      if (!organizationId || !businessCenterId) {
        setNotifications([]);
        setTasks([]);
        hasLoadedRef.current = false;
      }
      return undefined;
    }

    let mounted = true;
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
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
          hasLoadedRef.current = true;
        }
      });

    const unsubscribe = subscribeToOwnerTaskChanges(organizationId, businessCenterId, {
      onNotificationInsert: (notification) => {
        Alert.alert(notification.title, notification.body);
      },
      onRefresh: scheduleLoadTasks,
    });

    return () => {
      mounted = false;
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [authReady, businessCenterId, loadTasks, organizationId, scheduleLoadTasks]);

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

  const markNotificationRead = useCallback(
    async (notificationId: string): Promise<void> => {
      const target = notifications.find((item) => item.id === notificationId);
      if (!target || !target.isUnread) {
        return;
      }

      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, isUnread: false, readAt } : item,
        ),
      );

      try {
        await markOwnerNotificationRead(notificationId);
      } catch (error) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId
              ? { ...item, isUnread: true, readAt: null }
              : item,
          ),
        );
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
      }
    },
    [notifications],
  );

  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    const unreadIds = notifications.filter((item) => item.isUnread).map((item) => item.id);
    if (unreadIds.length === 0) {
      return;
    }

    const previous = notifications;
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) =>
        item.isUnread ? { ...item, isUnread: false, readAt } : item,
      ),
    );

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await markOwnerNotificationsRead(unreadIds);
    } catch (error) {
      setNotifications(previous);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(message);
      Alert.alert('No se pudieron marcar como leídas', message);
    } finally {
      setIsSaving(false);
    }
  }, [notifications]);

  const loadMoreNotifications = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId || isLoadingMoreNotifications || !hasMoreNotifications) {
      return;
    }

    const oldest = notifications[notifications.length - 1];
    if (!oldest) {
      return;
    }

    setIsLoadingMoreNotifications(true);
    try {
      const nextPage = await getOwnerNotifications(organizationId, businessCenterId, {
        beforeCreatedAt: oldest.createdAt,
        currentUserId: currentUserIdRef.current,
        limit: NOTIFICATIONS_PAGE_SIZE,
      });
      setNotifications((current) => {
        const seen = new Set(current.map((item) => item.id));
        const merged = [...current];
        for (const item of nextPage) {
          if (!seen.has(item.id)) {
            merged.push(item);
          }
        }
        return merged;
      });
      setHasMoreNotifications(nextPage.length >= NOTIFICATIONS_PAGE_SIZE);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(message);
      Alert.alert('No se pudieron cargar más notificaciones', message);
    } finally {
      setIsLoadingMoreNotifications(false);
    }
  }, [
    businessCenterId,
    hasMoreNotifications,
    isLoadingMoreNotifications,
    notifications,
    organizationId,
  ]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => item.isUnread).length,
    [notifications],
  );

  const enablePushNotifications = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      return;
    }

    setErrorMessage(null);

    try {
      await ensureAndroidNotificationChannels();

      const permissions = await Notifications.getPermissionsAsync();
      const finalPermissions = permissions.granted
        ? permissions
        : await Notifications.requestPermissionsAsync();

      if (!finalPermissions.granted) {
        setPushRegistrationStatus('No se otorgó el permiso de notificaciones.');
        return;
      }

      const projectId = getEasProjectId();
      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      await registerOwnerPushToken(organizationId, businessCenterId, token.data);
      setPushRegistrationStatus('Las notificaciones push quedan activas en este dispositivo.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown push registration error';
      setErrorMessage(message);
      setPushRegistrationStatus('No se pudieron activar las notificaciones push.');
    }
  }, [businessCenterId, organizationId]);


  useEffect(() => {
    if (!authReady || !organizationId || !businessCenterId) {
      return;
    }
    void enablePushNotifications().catch(() => {
      // Permission denied / simulator — non-blocking.
    });
  }, [authReady, businessCenterId, enablePushNotifications, organizationId]);

  return {
    cancelTask,
    completeTask,
    createAppointmentFromTask: createAppointmentFromTaskHandler,
    createTask: createTaskHandler,
    currentUserId,
    dismissNotification,
    enablePushNotifications,
    errorMessage,
    followTask,
    hasMoreNotifications,
    isLoading,
    isLoadingMoreNotifications,
    isSaving,
    loadMoreNotifications,
    markAllNotificationsRead,
    markNotificationRead,
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
    unreadNotificationCount,
  };
}

function buildAssigneeMap(members: OrganizationMember[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    map.set(member.userId, member.displayName);
  }
  return map;
}
