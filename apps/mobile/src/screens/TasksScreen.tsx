import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionRow, Card, NotificationRow, ScreenContent, ScreenTitle } from '../components/ui';
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
  { id: 'follow_up', label: 'Seguimientos' },
  { id: 'stock', label: 'Stock' },
  { id: 'overdue', label: 'Vencidas' },
  { id: 'snoozed', label: 'Pospuestas' },
];

export function TasksScreen(props: {
  initialFilter?: WorkQueueFilter;
  isLoading?: boolean;
  isSaving?: boolean;
  notifications: OwnerNotification[];
  onCompleteTask: (taskId: string) => Promise<void>;
  onDismissAlert: (notificationId: string) => Promise<void>;
  onOpenAlertProduct: (productId: string) => void;
  onOpenCopi: () => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onSnoozeTask: (taskId: string) => Promise<void>;
  tasks: OwnerTask[];
}): ReactElement {
  const [activeFilter, setActiveFilter] = useState<WorkQueueFilter>(props.initialFilter ?? 'all');
  const items = useMemo(
    () => filterWorkQueue(buildWorkQueue(props.tasks, props.notifications), activeFilter),
    [activeFilter, props.notifications, props.tasks],
  );

  return (
    <ScreenContent>
      <ScreenTitle subtitle="Seguimientos, alertas y tareas del negocio" title="Centro de tareas" />

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
              onCompleteTask={props.onCompleteTask}
              onDismissAlert={props.onDismissAlert}
              onOpenAlertProduct={props.onOpenAlertProduct}
              onOpenConversation={props.onOpenConversation}
              onOpenTaskDetail={props.onOpenTaskDetail}
              onSnoozeTask={props.onSnoozeTask}
            />
          ))}
        </Card>
      )}

      <Card flush>
        <ActionRow icon="message" onPress={props.onOpenCopi} title="Pedile a Copi que cree o asigne tareas" />
      </Card>
    </ScreenContent>
  );
}

function WorkQueueRow(props: {
  isSaving?: boolean;
  item: WorkQueueItem;
  onCompleteTask: (taskId: string) => Promise<void>;
  onDismissAlert: (notificationId: string) => Promise<void>;
  onOpenAlertProduct: (productId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onSnoozeTask: (taskId: string) => Promise<void>;
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
        />
      </Pressable>
      <View style={styles.actions}>
        {props.item.kind === 'task' && props.item.taskId ? (
          <>
            <Pressable disabled={props.isSaving} onPress={() => void props.onSnoozeTask(props.item.taskId!)}>
              <Text style={styles.actionText}>Posponer</Text>
            </Pressable>
            <Pressable disabled={props.isSaving} onPress={() => void props.onCompleteTask(props.item.taskId!)}>
              <Text style={styles.actionTextPrimary}>Hecho</Text>
            </Pressable>
          </>
        ) : props.item.notificationId ? (
          <Pressable
            disabled={props.isSaving}
            onPress={() => void props.onDismissAlert(props.item.notificationId!)}
          >
            <Text style={styles.actionTextPrimary}>Descartar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionText: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '500',
  },
  actionTextPrimary: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
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
    fontSize: 12,
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
    fontSize: 10,
    fontWeight: '300',
  },
  row: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
  },
  rowBody: {
    paddingTop: 4,
  },
});
