import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

import { ensureAndroidNotificationChannels } from '../lib/androidNotificationChannels';
import { showPermissionDeniedAlert } from '../lib/androidPermissions';
import { getEasProjectId } from '../lib/easProject';

import {
  completeOwnerTask,
  dismissAllOwnerNotifications,
  dismissOwnerNotification,
  getOwnerNotifications,
  getOwnerTasks,
  registerOwnerPushToken,
  snoozeOwnerTask,
  subscribeToOwnerTaskChanges,
} from '../api/tasks';
import type { OwnerNotification, OwnerTask } from '../types/tasks';

export interface OwnerTasksState {
  completeTask: (taskId: string) => Promise<void>;
  dismissAllNotifications: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  enablePushNotifications: () => Promise<void>;
  errorMessage: string | null;
  isLoading: boolean;
  isSaving: boolean;
  notifications: OwnerNotification[];
  pushRegistrationStatus: string | null;
  snoozeTask: (taskId: string) => Promise<void>;
  tasks: OwnerTask[];
}

export function useOwnerTasks(
  organizationId: string | null,
  businessCenterId: string | null,
): OwnerTasksState {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [pushRegistrationStatus, setPushRegistrationStatus] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OwnerTask[]>([]);

  const loadTasks = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      setNotifications([]);
      setTasks([]);
      return;
    }

    const [nextTasks, nextNotifications] = await Promise.all([
      getOwnerTasks(organizationId, businessCenterId),
      getOwnerNotifications(organizationId, businessCenterId),
    ]);
    setTasks(nextTasks);
    setNotifications(nextNotifications);
  }, [businessCenterId, organizationId]);

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
        Alert.alert('Could not load follow-ups', message);
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

  const completeTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }

      await runTaskAction({
        action: () => completeOwnerTask(organizationId, businessCenterId, taskId),
        failureTitle: 'Could not complete task',
        refresh: loadTasks,
        setErrorMessage,
        setIsSaving,
      });
    },
    [businessCenterId, loadTasks, organizationId],
  );

  const snoozeTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }

      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await runTaskAction({
        action: () => snoozeOwnerTask(organizationId, businessCenterId, taskId, snoozedUntil),
        failureTitle: 'Could not snooze task',
        refresh: loadTasks,
        setErrorMessage,
        setIsSaving,
      });
    },
    [businessCenterId, loadTasks, organizationId],
  );

  const dismissNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }

      await runTaskAction({
        action: () => dismissOwnerNotification(organizationId, businessCenterId, notificationId),
        failureTitle: 'Could not dismiss alert',
        refresh: loadTasks,
        setErrorMessage,
        setIsSaving,
      });
    },
    [businessCenterId, loadTasks, organizationId],
  );

  const dismissAllNotifications = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      return;
    }

    await runTaskAction({
      action: () => dismissAllOwnerNotifications(organizationId, businessCenterId),
      failureTitle: 'Could not dismiss alerts',
      refresh: loadTasks,
      setErrorMessage,
      setIsSaving,
    });
  }, [businessCenterId, loadTasks, organizationId]);

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
    completeTask,
    dismissAllNotifications,
    dismissNotification,
    enablePushNotifications,
    errorMessage,
    isLoading,
    isSaving,
    notifications,
    pushRegistrationStatus,
    snoozeTask,
    tasks,
  };
}

async function runTaskAction(params: {
  action: () => Promise<void>;
  failureTitle: string;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | null) => void;
  setIsSaving: (isSaving: boolean) => void;
}): Promise<void> {
  params.setIsSaving(true);
  params.setErrorMessage(null);

  try {
    await params.action();
    await params.refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    params.setErrorMessage(message);
    Alert.alert(params.failureTitle, message);
  } finally {
    params.setIsSaving(false);
  }
}
