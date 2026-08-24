import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type ReminderLeadMinutes,
} from '../api/notifications';
import { Icon } from '../components/icons';
import { MobileContainedModal } from '../components/MobileContainedModal';
import { Card, NotificationRow, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate, useFeatureVisibility } from '../hooks/useFeatureVisibility';
import {
  buildWorkQueue,
  filterWorkQueue,
  formatWorkQueueTime,
  type WorkQueueFilter,
} from '../lib/workQueue';
import type { OwnerNotification } from '../types/tasks';
import { colors } from '../theme';

const FILTERS: Array<{ id: WorkQueueFilter | 'unread'; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'No leídas' },
  { id: 'stock', label: 'Stock' },
];

const LEAD_OPTIONS: ReminderLeadMinutes[] = [15, 30, 60];

export function NotificationsScreen(props: {
  isLoading?: boolean;
  isSaving?: boolean;
  notifications: OwnerNotification[];
  onDismissAll: () => Promise<void>;
  onDismissNotification: (notificationId: string) => Promise<void>;
  onOpenNotification: (notificationId: string) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onOpenTasks: () => void;
  organizationId?: string | null;
}): ReactElement {
  const [activeFilter, setActiveFilter] = useState<WorkQueueFilter | 'unread'>('all');
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<ReminderLeadMinutes>(30);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const flags = useFeatureVisibility();
  const insets = useSafeAreaInsets();
  const showFilters = flags.notificationsFilters;

  const items = useMemo(() => {
    // Alerts only — task rows live on Tareas (avoids gating this screen on Nest /tasks).
    const queue = buildWorkQueue([], props.notifications);
    if (activeFilter === 'unread') {
      return queue.filter((item) => item.isUnread);
    }

    return filterWorkQueue(queue, activeFilter);
  }, [activeFilter, props.notifications]);

  const activeFilterLabel =
    activeFilter === 'all' ? null : (FILTERS.find((filter) => filter.id === activeFilter)?.label ?? null);

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
        <View style={styles.titleBlock}>
          <ScreenTitle title="Notificaciones" />
        </View>
        <Pressable
          accessibilityLabel="Más opciones"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
        >
          <Icon color={colors.slate} kind="dots-vertical" size={22} strokeWidth={1.8} />
        </Pressable>
      </View>

      {activeFilterLabel ? (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterLabel}>Filtro: {activeFilterLabel}</Text>
          <Pressable hitSlop={8} onPress={() => setActiveFilter('all')}>
            <Text style={styles.clearFilter}>Quitar</Text>
          </Pressable>
        </View>
      ) : null}

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
            {items.map((item, index) => {
              const notificationId = item.notificationId;

              const openDestination = (): void => {
                if (item.kind === 'task' && item.taskId) {
                  props.onOpenTaskDetail(item.taskId);
                  return;
                }

                if (notificationId) {
                  props.onOpenNotification(notificationId);
                }
              };

              return (
                <View
                  key={item.id}
                  style={[styles.alertRow, index < items.length - 1 && styles.alertRowDivider]}
                >
                  <View style={styles.alertRowBody}>
                    <NotificationRow
                      notification={{
                        id: item.id,
                        subtitle: item.subtitle,
                        time: formatWorkQueueTime(item.timestamp),
                        title: item.title,
                        tone: item.tone,
                        unread: item.isUnread,
                      }}
                      onPress={
                        (item.kind === 'task' && item.taskId) || notificationId
                          ? openDestination
                          : undefined
                      }
                      showDivider={false}
                    />
                  </View>
                  {notificationId && item.kind === 'alert' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={props.isSaving}
                      hitSlop={6}
                      onPress={() => {
                        void props.onDismissNotification(notificationId);
                      }}
                      style={({ pressed }) => [
                        styles.dismissButton,
                        pressed && styles.dismissButtonPressed,
                        props.isSaving && styles.dismissButtonDisabled,
                      ]}
                    >
                      <Text style={styles.dismissText}>Descartar</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Card>
        )}
      </FeatureGate>

      <MobileContainedModal
        animationType="slide"
        onClose={() => setMenuOpen(false)}
        sheetStyle={{
          ...styles.menuSheet,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        visible={menuOpen}
      >
        <View style={styles.menuHandle} />
        <Text style={styles.menuTitle}>Opciones</Text>

        <Pressable
          disabled={props.isSaving}
          onPress={() => {
            void props.onDismissAll();
            setMenuOpen(false);
          }}
          style={({ pressed }) => [styles.menuAction, pressed && styles.menuActionPressed]}
        >
          <Text style={styles.menuActionText}>Marcar todas como leídas</Text>
        </Pressable>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Recordatorios</Text>
          <Text style={styles.menuSectionHint}>Avisame antes de tareas y turnos (minutos)</Text>
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
        </View>

        {showFilters ? (
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>Filtros</Text>
            <View style={styles.filterRow}>
              {FILTERS.map((filter) => (
                <Pressable
                  key={filter.id}
                  onPress={() => {
                    setActiveFilter(filter.id);
                    setMenuOpen(false);
                  }}
                  style={[styles.filterPill, activeFilter === filter.id && styles.activeFilterPill]}
                >
                  <Text
                    style={[styles.filterText, activeFilter === filter.id && styles.activeFilterText]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </MobileContainedModal>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  activeFilterLabel: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '500',
  },
  activeFilterPill: {
    borderColor: colors.primary,
  },
  activeFilterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activeFilterText: {
    color: colors.primary,
  },
  alertRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  alertRowBody: {
    flex: 1,
    minWidth: 0,
  },
  alertRowDivider: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
  },
  clearFilter: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    marginRight: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dismissButtonDisabled: {
    opacity: 0.5,
  },
  dismissButtonPressed: {
    opacity: 0.7,
  },
  dismissText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
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
    marginTop: 10,
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
  menuAction: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuActionPressed: {
    backgroundColor: colors.primarySoft,
  },
  menuActionText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  menuButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginTop: 2,
    width: 40,
  },
  menuButtonPressed: {
    opacity: 0.7,
  },
  menuHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 40,
  },
  menuSection: {
    marginTop: 4,
  },
  menuSectionHint: {
    color: colors.slate,
    fontSize: 13,
    marginTop: 2,
  },
  menuSectionTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  menuSheet: {
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  menuTitle: {
    color: colors.navy,
    fontSize: 18,
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
  titleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
