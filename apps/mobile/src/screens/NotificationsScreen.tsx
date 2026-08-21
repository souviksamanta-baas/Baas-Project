import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type ReminderLeadMinutes,
} from '../api/notifications';
import { Card, NotificationRow, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
import {
  buildWorkQueue,
  filterWorkQueue,
  formatWorkQueueTime,
  type WorkQueueFilter,
} from '../lib/workQueue';
import type { OwnerNotification, OwnerTask } from '../types/tasks';
import { colors } from '../theme';

const FILTERS: Array<{ id: WorkQueueFilter | 'unread'; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'No leidas' },
  { id: 'stock', label: 'Stock' },
  { id: 'follow_up', label: 'Seguimientos' },
];

const LEAD_OPTIONS: ReminderLeadMinutes[] = [15, 30, 60];

export function NotificationsScreen(props: {
  isLoading?: boolean;
  isSaving?: boolean;
  notifications: OwnerNotification[];
  onDismissAll: () => Promise<void>;
  onDismissNotification: (notificationId: string) => Promise<void>;
  onOpenAlertProduct: (productId: string) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onOpenTasks: () => void;
  organizationId?: string | null;
  tasks: OwnerTask[];
}): ReactElement {
  const [activeFilter, setActiveFilter] = useState<WorkQueueFilter | 'unread'>('all');
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<ReminderLeadMinutes>(30);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const items = useMemo(() => {
    const queue = buildWorkQueue(props.tasks, props.notifications);
    if (activeFilter === 'unread') {
      return queue.filter((item) => item.isUnread);
    }

    return filterWorkQueue(queue, activeFilter);
  }, [activeFilter, props.notifications, props.tasks]);

  useEffect(() => {
    if (!props.organizationId) {
      return;
    }
    let mounted = true;
    void getNotificationPrefs(props.organizationId)
      .then((prefs) => {
        if (mounted) {
          setReminderLeadMinutes(prefs.reminderLeadMinutes);
        }
      })
      .catch(() => {
        // Keep default.
      });
    return () => {
      mounted = false;
    };
  }, [props.organizationId]);

  async function saveLead(minutes: ReminderLeadMinutes): Promise<void> {
    if (!props.organizationId) {
      return;
    }
    setReminderLeadMinutes(minutes);
    setPrefsSaving(true);
    try {
      await updateNotificationPrefs({
        organizationId: props.organizationId,
        reminderLeadMinutes: minutes,
      });
    } finally {
      setPrefsSaving(false);
    }
  }

  return (
    <ScreenContent title="Notificaciones">
      <View style={styles.titleRow}>
        <ScreenTitle title="Notificaciones" />
        <Pressable disabled={props.isSaving} onPress={() => void props.onDismissAll()}>
          <Text style={styles.markRead}>Marcar todas como leidas</Text>
        </Pressable>
      </View>

      <Card style={styles.prefsCard}>
        <Text style={styles.prefsTitle}>Recordatorios</Text>
        <Text style={styles.prefsHint}>Avisame antes de tareas y turnos (minutos)</Text>
        <View style={styles.leadRow}>
          {LEAD_OPTIONS.map((minutes) => (
            <Pressable
              key={minutes}
              disabled={prefsSaving}
              onPress={() => void saveLead(minutes)}
              style={[styles.leadPill, reminderLeadMinutes === minutes && styles.leadPillActive]}
            >
              <Text
                style={[styles.leadText, reminderLeadMinutes === minutes && styles.leadTextActive]}
              >
                {minutes}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <FeatureGate feature="notificationsFilters">
        <View style={styles.filterRow}>
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.id}
              onPress={() => setActiveFilter(filter.id)}
              style={[styles.filterPill, activeFilter === filter.id && styles.activeFilterPill]}
            >
              <Text style={[styles.filterText, activeFilter === filter.id && styles.activeFilterText]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </FeatureGate>

      <Pressable onPress={props.onOpenTasks} style={styles.tasksLink}>
        <Text style={styles.tasksLinkText}>Ver todas las tareas</Text>
      </Pressable>

      <FeatureGate feature="notificationsList">
        {props.isLoading ? <Text style={styles.emptyText}>Cargando alertas...</Text> : null}
        {!props.isLoading && items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No hay alertas activas.</Text>
          </Card>
        ) : (
          <Card flush>
            {items.map((item, index) => (
              <NotificationRow
                key={item.id}
                notification={{
                  id: item.id,
                  subtitle: item.subtitle,
                  time: formatWorkQueueTime(item.timestamp),
                  title: item.title,
                  tone: item.tone,
                  unread: item.isUnread,
                }}
                onPress={() => {
                  if (item.kind === 'task' && item.taskId) {
                    props.onOpenTaskDetail(item.taskId);
                    return;
                  }

                  if (item.productId) {
                    props.onOpenAlertProduct(item.productId);
                    return;
                  }

                  props.onOpenTasks();
                }}
                showDivider={index < items.length - 1}
              />
            ))}
          </Card>
        )}
      </FeatureGate>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  activeFilterPill: {
    borderColor: colors.primary,
  },
  activeFilterText: {
    color: colors.primary,
  },
  emptyCard: {
    padding: 16,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 15,
  },
  filterPill: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  filterText: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '300',
  },
  leadPill: {
    borderColor: colors.borderInput,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  leadPillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  leadRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  leadText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  leadTextActive: {
    color: colors.primary,
  },
  markRead: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '300',
    paddingBottom: 2,
  },
  prefsCard: {
    padding: 14,
  },
  prefsHint: {
    color: colors.slate,
    fontSize: 13,
    marginTop: 2,
  },
  prefsTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  tasksLink: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tasksLinkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  titleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
