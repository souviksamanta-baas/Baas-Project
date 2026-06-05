import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

import {
  completeOwnerTask,
  dismissOwnerNotification,
  getOwnerNotifications,
  getOwnerTasks,
  registerOwnerPushToken,
  snoozeOwnerTask,
  subscribeToOwnerTaskChanges,
} from '../services/tasks';
import type { OwnerNotification, OwnerTask } from '../types/tasks';

export interface OwnerTasksState {
  completeTask: (taskId: string) => Promise<void>;
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

export function useOwnerTasks(organizationId: string | null): OwnerTasksState {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [pushRegistrationStatus, setPushRegistrationStatus] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OwnerTask[]>([]);

  const loadTasks = useCallback(async (): Promise<void> => {
    if (!organizationId) {
      setNotifications([]);
      setTasks([]);
      return;
    }

    const [nextTasks, nextNotifications] = await Promise.all([
      getOwnerTasks(organizationId),
      getOwnerNotifications(organizationId),
    ]);
    setTasks(nextTasks);
    setNotifications(nextNotifications);
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
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

    const unsubscribe = subscribeToOwnerTaskChanges(organizationId, {
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
  }, [loadTasks, organizationId]);

  const completeTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId) {
        return;
      }

      await runTaskAction({
        action: () => completeOwnerTask(organizationId, taskId),
        failureTitle: 'Could not complete task',
        refresh: loadTasks,
        setErrorMessage,
        setIsSaving,
      });
    },
    [loadTasks, organizationId],
  );

  const snoozeTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!organizationId) {
        return;
      }

      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await runTaskAction({
        action: () => snoozeOwnerTask(organizationId, taskId, snoozedUntil),
        failureTitle: 'Could not snooze task',
        refresh: loadTasks,
        setErrorMessage,
        setIsSaving,
      });
    },
    [loadTasks, organizationId],
  );

  const dismissNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!organizationId) {
        return;
      }

      await runTaskAction({
        action: () => dismissOwnerNotification(organizationId, notificationId),
        failureTitle: 'Could not dismiss alert',
        refresh: loadTasks,
        setErrorMessage,
        setIsSaving,
      });
    },
    [loadTasks, organizationId],
  );

  const enablePushNotifications = useCallback(async (): Promise<void> => {
    if (!organizationId) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const permissions = await Notifications.getPermissionsAsync();
      const finalPermissions = permissions.granted
        ? permissions
        : await Notifications.requestPermissionsAsync();

      if (!finalPermissions.granted) {
        setPushRegistrationStatus('Push permission was not granted.');
        return;
      }

      const token = await Notifications.getExpoPushTokenAsync();
      await registerOwnerPushToken(organizationId, token.data);
      setPushRegistrationStatus('Low-stock push alerts are enabled on this device.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown push registration error';
      setErrorMessage(message);
      setPushRegistrationStatus('Push registration failed on this device.');
      Alert.alert('Could not enable push alerts', message);
    } finally {
      setIsSaving(false);
    }
  }, [organizationId]);

  return {
    completeTask,
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
