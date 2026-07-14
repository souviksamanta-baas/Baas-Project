import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, NotificationRow, ScreenContent, ScreenTitle } from '../components/ui';
import { FeatureGate } from '../hooks/useFeatureVisibility';
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
  { id: 'unread', label: 'No leidas' },
  { id: 'stock', label: 'Stock' },
  { id: 'follow_up', label: 'Seguimientos' },
];

export function NotificationsScreen(props: {
  isLoading?: boolean;
  isSaving?: boolean;
  notifications: OwnerNotification[];
  onDismissAll: () => Promise<void>;
  onDismissNotification: (notificationId: string) => Promise<void>;
  onOpenAlertProduct: (productId: string) => void;
  onOpenTasks: () => void;
}): ReactElement {
  const [activeFilter, setActiveFilter] = useState<WorkQueueFilter | 'unread'>('all');
  const items = useMemo(() => {
    const queue = buildWorkQueue([], props.notifications);
    if (activeFilter === 'unread') {
      return queue.filter((item) => item.isUnread);
    }

    return filterWorkQueue(queue, activeFilter);
  }, [activeFilter, props.notifications]);

  return (
    <ScreenContent>
      <View style={styles.titleRow}>
        <ScreenTitle subtitle="Todo lo que necesita tu atencion" title="Notificaciones" />
        <Pressable disabled={props.isSaving} onPress={() => void props.onDismissAll()}>
          <Text style={styles.markRead}>Marcar todas como leidas</Text>
        </Pressable>
      </View>

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

      <FeatureGate feature="notificationsList">
        {props.isLoading ? <Text style={styles.emptyText}>Cargando alertas...</Text> : null}
        {!props.isLoading && items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No hay alertas activas.</Text>
          </Card>
        ) : (
          <Card>
            {items.map((item) => (
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
                  if (item.productId) {
                    props.onOpenAlertProduct(item.productId);
                    return;
                  }

                  props.onOpenTasks();
                }}
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
    fontSize: 12,
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
    fontSize: 10,
    fontWeight: '300',
  },
  markRead: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    paddingBottom: 2,
  },
  titleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
