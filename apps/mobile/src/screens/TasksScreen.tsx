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
import type { OwnerTask } from '../types/tasks';
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
  onOpenCopi: () => void;
  onOpenNewTask: () => void;
  onOpenTaskDetail: (taskId: string) => void;
  role: 'owner' | 'co_owner' | 'manager' | 'staff' | undefined;
  tasks: OwnerTask[];
}): ReactElement {
  const [activeFilter, setActiveFilter] = useState<WorkQueueFilter>(props.initialFilter ?? 'all');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Tasks portal is tasks-only — never mix in owner_notifications (member joined, stock, etc.).
  const items = useMemo(
    () => filterWorkQueue(buildWorkQueue(props.tasks, []), activeFilter),
    [activeFilter, props.tasks],
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
          <Text style={styles.emptyText}>No hay tareas para este filtro.</Text>
        </Card>
      ) : (
        <Card flush>
          {items.map((item) => (
            <TaskQueueRow
              isSaving={props.isSaving}
              item={item}
              key={item.id}
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

function TaskQueueRow(props: {
  isSaving?: boolean;
  item: WorkQueueItem;
  onOpenMenu: (taskId: string) => void;
  onOpenTaskDetail: (taskId: string) => void;
}): ReactElement {
  const taskId = props.item.taskId;

  return (
    <View style={styles.row}>
      <Pressable
        disabled={props.isSaving || !taskId}
        onPress={() => {
          if (taskId) {
            props.onOpenTaskDetail(taskId);
          }
        }}
        style={styles.rowBody}
      >
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

      {taskId ? (
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
      ) : (
        <View style={styles.menuSpacer} />
      )}
    </View>
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
    alignSelf: 'center',
    height: 36,
    justifyContent: 'center',
    marginRight: 6,
    width: 36,
  },
  menuButtonDisabled: {
    opacity: 0.5,
  },
  menuButtonPressed: {
    backgroundColor: colors.surfaceMint,
    borderRadius: 999,
  },
  menuSpacer: {
    width: 36,
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
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
});
