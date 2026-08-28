import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationTypeId,
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

/** Types still without a production emitter — shown disabled as Próximamente. */
export const NOTIFICATION_TYPES_COMING_SOON = new Set<NotificationTypeId>([]);

const TOGGLE_TYPES: Array<{ id: NotificationTypeId; label: string }> = [
  { id: 'stock.low', label: 'Stock bajo' },
  { id: 'stock.movement', label: 'Movimiento de stock' },
  { id: 'task.assigned', label: 'Tarea asignada' },
  { id: 'task.reminder', label: 'Recordatorio de tarea' },
  { id: 'task.overdue', label: 'Tarea vencida' },
  { id: 'inbox.new_message', label: 'Nuevo mensaje' },
  { id: 'inbox.unanswered', label: 'Sin responder' },
  { id: 'sales.completed', label: 'Venta registrada' },
  { id: 'payment.received', label: 'Pago recibido' },
  { id: 'payment.failed', label: 'Problema de pago' },
  { id: 'quote.accepted', label: 'Presupuesto aceptado' },
  { id: 'invoice.overdue', label: 'Factura vencida' },
  { id: 'appointment.reminder', label: 'Recordatorio de turno' },
  { id: 'digest.daily', label: 'Resumen diario' },
  { id: 'copi.action_needed', label: 'Copi necesita confirmación' },
  { id: 'team.invite_accepted', label: 'Miembro se unió' },
];

export function NotificationsScreen(props: {
  hasMore?: boolean;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  isSaving?: boolean;
  notifications: OwnerNotification[];
  onDismissNotification: (notificationId: string) => Promise<void>;
  onLoadMore?: () => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onOpenNotification: (notificationId: string) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onOpenTasks: () => void;
  organizationId?: string | null;
}): ReactElement {
  const [activeFilter, setActiveFilter] = useState<WorkQueueFilter | 'unread'>('all');
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<ReminderLeadMinutes>(30);
  const [enabledMap, setEnabledMap] = useState<Partial<Record<NotificationTypeId, boolean>>>({});
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const flags = useFeatureVisibility();
  const insets = useSafeAreaInsets();
  const showFilters = flags.notificationsFilters;

  const items = useMemo(() => {
    const queue = buildWorkQueue([], props.notifications).sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
    if (activeFilter === 'unread') {
      return queue.filter((item) => item.isUnread);
    }

    return filterWorkQueue(queue, activeFilter);
  }, [activeFilter, props.notifications]);

  const unreadCount = useMemo(
    () => props.notifications.filter((item) => item.isUnread).length,
    [props.notifications],
  );

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
          setEnabledMap(prefs.enabled ?? {});
        }
      })
      .catch(() => {
        // Keep defaults.
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

  async function saveToggle(typeId: NotificationTypeId, value: boolean): Promise<void> {
    if (!props.organizationId || NOTIFICATION_TYPES_COMING_SOON.has(typeId)) {
      return;
    }
    const next = { ...enabledMap, [typeId]: value };
    setEnabledMap(next);
    setPrefsSaving(true);
    try {
      await updateNotificationPrefs({
        enabled: next,
        organizationId: props.organizationId,
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
        {props.isLoading ? <Text style={styles.emptyText}>Cargando notificaciones...</Text> : null}
        {!props.isLoading && items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {activeFilter === 'unread' || unreadCount === 0
                ? 'No hay notificaciones nuevas.'
                : 'No hay notificaciones.'}
            </Text>
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

        {props.hasMore ? (
          <Pressable
            disabled={props.isLoadingMore}
            onPress={() => {
              void props.onLoadMore?.();
            }}
            style={({ pressed }) => [styles.loadMoreButton, pressed && styles.menuButtonPressed]}
          >
            <Text style={styles.loadMoreText}>
              {props.isLoadingMore ? 'Cargando...' : 'Ver más notificaciones'}
            </Text>
          </Pressable>
        ) : null}
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
            void props.onMarkAllRead();
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

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Tipos de notificación</Text>
          <Text style={styles.menuSectionHint}>Elegí qué querés recibir</Text>
          {TOGGLE_TYPES.map((entry) => {
            const comingSoon = NOTIFICATION_TYPES_COMING_SOON.has(entry.id);
            const value = enabledMap[entry.id];
            const isOn = typeof value === 'boolean' ? value : true;
            return (
              <View key={entry.id} style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleLabel}>{entry.label}</Text>
                  {comingSoon ? <Text style={styles.comingSoon}>Próximamente</Text> : null}
                </View>
                <Switch
                  disabled={comingSoon || prefsSaving}
                  onValueChange={(next) => void saveToggle(entry.id, next)}
                  value={comingSoon ? false : isOn}
                />
              </View>
            );
          })}
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
  comingSoon: {
    color: colors.slate,
    fontSize: 12,
    marginTop: 2,
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
  loadMoreButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
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
  toggleCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  toggleLabel: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
