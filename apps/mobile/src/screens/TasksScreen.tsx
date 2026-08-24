import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionRow, Card, NotificationRow, ScreenContent, ScreenTitle } from '../components/ui';
import { Icon } from '../components/icons';
import { TaskActionsMenu, resolveTaskPermissions } from '../components/TaskActionsMenu';
import type { OrganizationMember } from '../api/accountLifecycle';
import {
  buildWorkQueue,
  filterWorkQueue,
  formatWorkQueueTime,
  type WorkQueueFilter,
  type WorkQueueItem,
} from '../lib/workQueue';
import type { OwnerNotification, OwnerTask } from '../types/tasks';
import { colors } from '../theme';

const FILTERS: Array<{ id: WorkQueueFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'in_progress', label: 'En curso' },
  { id: 'postponed', label: 'Pospuestas' },
  { id: 'overdue', label: 'Vencidas' },
];

export interface TasksScreenActions {
  onCancelTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string) => Promise<void>;
  onCreateAppointmentFromTask: (taskId: string, startsAt: Date) => Promise<void>;
  onFollowTask: (taskId: string) => Promise<void>;
  onPostponeTask: (taskId: string, postponedUntil: Date) => Promise<void>;
  onReassignTask: (taskId: string, userId: string) => Promise<void>;
  onSnoozeReminder: (taskId: string, minutes: number) => Promise<void>;
  onStartTask: (taskId: string) => Promise<void>;
  onUnfollowTask: (taskId: string) => Promise<void>;
}

export function TasksScreen(props: {
  actions: TasksScreenActions;
  currentUserId: string | null;
  initialFilter?: WorkQueueFilter;
  isLoading?: boolean;
  isSaving?: boolean;
  members: OrganizationMember[];
  notifications: OwnerNotification[];
  onDismissAlert: (notificationId: string) => Promise<void>;
  onOpenAlertProduct: (productId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenCopi: () => void;
  onOpenNewTask: () => void;
  onOpenTaskDetail: (taskId: string) => void;
  role: 'owner' | 'co_owner' | 'manager' | 'staff' | undefined;
  tasks: OwnerTask[];
}): ReactElement {
  const [activeFilter, setActiveFilter] = useState<WorkQueueFilter>(props.initialFilter ?? 'all');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const items = useMemo(
    () => filterWorkQueue(buildWorkQueue(props.tasks, props.notifications), activeFilter),
    [activeFilter, props.notifications, props.tasks],
  );

  const openTask = useMemo(
    () => props.tasks.find((task) => task.id === openTaskId) ?? null,
    [openTaskId, props.tasks],
  );

  return (
    <ScreenContent title="Todas las tareas">
      <ScreenTitle title="Todas las tareas" />

      <Pressable
        accessibilityRole="button"
        onPress={props.onOpenNewTask}
        style={({ pressed }) => [styles.newTaskCta, pressed && styles.newTaskCtaPressed]}
      >
        <Icon color={colors.surface} kind="plus" size={16} strokeWidth={2.2} />
        <Text style={styles.newTaskLabel}>Nueva tarea</Text>
      </Pressable>

      {props.isLoading ? <ActivityIndicator color={colors.primary} /> : null}

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

      {items.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No hay tareas ni alertas para este filtro.</Text>
        </Card>
      ) : (
        <Card flush>
          {items.map((item) => (
            <WorkQueueRow
              isSaving={props.isSaving}
              item={item}
              key={item.id}
              onDismissAlert={props.onDismissAlert}
              onOpenAlertProduct={props.onOpenAlertProduct}
              onOpenConversation={props.onOpenConversation}
              onOpenMenu={(taskId) => setOpenTaskId(taskId)}
              onOpenTaskDetail={props.onOpenTaskDetail}
            />
          ))}
        </Card>
      )}

      <Card flush>
        <ActionRow icon="message" onPress={props.onOpenCopi} title="Pedile a Copi que cree o asigne tareas" />
      </Card>

      {openTask ? (
        <TaskActionsMenu
          members={props.members}
          onCancelTask={() => void props.actions.onCancelTask(openTask.id)}
          onClose={() => setOpenTaskId(null)}
          onCompleteTask={() => void props.actions.onCompleteTask(openTask.id)}
          onCreateAppointment={(startsAt) =>
            void props.actions.onCreateAppointmentFromTask(openTask.id, startsAt)
          }
          onPostponeTask={(postponedUntil) =>
            void props.actions.onPostponeTask(openTask.id, postponedUntil)
          }
          onReassignTask={(userId) => void props.actions.onReassignTask(openTask.id, userId)}
          onSnoozeReminder={(minutes) => void props.actions.onSnoozeReminder(openTask.id, minutes)}
          onStartTask={() => void props.actions.onStartTask(openTask.id)}
          onToggleFollow={() =>
            void (openTask.isFollowing
              ? props.actions.onUnfollowTask(openTask.id)
              : props.actions.onFollowTask(openTask.id))
          }
          permissions={resolveTaskPermissions({
            currentUserId: props.currentUserId,
            role: props.role,
            task: openTask,
          })}
          task={openTask}
          visible
        />
      ) : null}
    </ScreenContent>
  );
}

function WorkQueueRow(props: {
  isSaving?: boolean;
  item: WorkQueueItem;
  onDismissAlert: (notificationId: string) => Promise<void>;
  onOpenAlertProduct: (productId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenMenu: (taskId: string) => void;
  onOpenTaskDetail: (taskId: string) => void;
}): ReactElement {
  const openItem = (): void => {
    if (props.item.kind === 'alert' && props.item.productId) {
      props.onOpenAlertProduct(props.item.productId);
      return;
    }

    if (props.item.kind === 'task' && props.item.conversationId) {
      props.onOpenConversation(props.item.conversationId);
      return;
    }

    if (props.item.taskId) {
      props.onOpenTaskDetail(props.item.taskId);
    }
  };

  const taskId = props.item.taskId;
  const notificationId = props.item.notificationId;

  return (
    <View style={styles.row}>
      <Pressable disabled={props.isSaving} onPress={openItem} style={styles.rowBody}>
        <NotificationRow
          notification={{
            id: props.item.id,
            subtitle: props.item.subtitle,
            time: formatWorkQueueTime(props.item.dueAt ?? props.item.timestamp),
            title: props.item.title,
            tone: props.item.tone,
            unread: props.item.isUnread,
          }}
          showDivider={false}
        />
      </Pressable>
      <View style={styles.actions}>
        {props.item.kind === 'task' && taskId ? (
          <Pressable
            accessibilityLabel="Más acciones"
            accessibilityRole="button"
            disabled={props.isSaving}
            hitSlop={10}
            onPress={() => props.onOpenMenu(taskId)}
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.menuButtonPressed,
              props.isSaving && styles.menuButtonDisabled,
            ]}
          >
            <Icon color={colors.slate} kind="dots-vertical" size={20} strokeWidth={1.8} />
          </Pressable>
        ) : notificationId ? (
          <Pressable
            accessibilityRole="button"
            disabled={props.isSaving}
            hitSlop={6}
            onPress={() => {
              void props.onDismissAlert(notificationId);
            }}
            style={({ pressed }) => [
              styles.actionButtonPrimary,
              pressed && styles.actionButtonPressed,
              props.isSaving && styles.actionButtonDisabled,
            ]}
          >
            <Text style={styles.actionTextPrimary}>Descartar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionTextPrimary: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 14,
    paddingHorizontal: 14,
    zIndex: 2,
  },
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterText: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '300',
  },
  menuButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  menuButtonDisabled: {
    opacity: 0.5,
  },
  menuButtonPressed: {
    backgroundColor: colors.surfaceMint,
  },
  newTaskCta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newTaskCtaPressed: {
    opacity: 0.85,
  },
  newTaskLabel: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
  },
  rowBody: {
    paddingTop: 4,
  },
});
