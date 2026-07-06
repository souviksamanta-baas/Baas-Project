import type { ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { useOwnerTasks } from '../hooks/useOwnerTasks';
import { colors } from '../theme';

export function TasksScreen(props: {
  businessCenterId: string | null;
  isLoading?: boolean;
  onCompleteTask: (taskId: string) => Promise<void>;
  onSnoozeTask: (taskId: string) => Promise<void>;
  organizationId: string | null;
  tasks: ReturnType<typeof useOwnerTasks>['tasks'];
}): ReactElement {
  return (
    <ScreenContent>
      <ScreenTitle subtitle="Seguimientos y tareas del negocio" title="Seguimientos" />

      {props.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : null}

      {props.tasks.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No hay seguimientos pendientes.</Text>
        </Card>
      ) : (
        <Card flush>
          {props.tasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <View style={styles.taskBody}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.contactLabel ? <Text style={styles.taskMeta}>{task.contactLabel}</Text> : null}
                {task.dueAt ? (
                  <Text style={styles.taskMeta}>
                    Vence {new Date(task.dueAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => void props.onSnoozeTask(task.id)}>
                  <Text style={styles.actionText}>Posponer</Text>
                </Pressable>
                <Pressable onPress={() => void props.onCompleteTask(task.id)}>
                  <Text style={styles.actionTextPrimary}>Hecho</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card flush>
        <ActionRow icon="message" onPress={() => undefined} title="Pedile a Copi que cree o asigne tareas" />
      </Card>
    </ScreenContent>
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
  },
  emptyCard: {
    padding: 16,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 12,
  },
  taskBody: {
    flex: 1,
    gap: 2,
  },
  taskMeta: {
    color: colors.slate,
    fontSize: 11,
  },
  taskRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  taskTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
});
