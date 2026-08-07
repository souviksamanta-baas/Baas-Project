import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { prepareTaskBody } from '../lib/taskDetail';
import { compactTaskTitle } from '../lib/workQueue';
import type { OwnerTask } from '../types/tasks';
import { colors } from '../theme';

export function TaskDetailScreen(props: {
  isSaving?: boolean;
  onBack: () => void;
  onCompleteTask: () => Promise<void>;
  onOpenConversation: (conversationId: string) => void;
  onOpenPresupuesto?: (quoteId: string) => void;
  onSnoozeTask: () => Promise<void>;
  task: OwnerTask;
}): ReactElement {
  const presupuestoId = props.task.presupuestoId;
  const displayTitle = compactTaskTitle(props.task.title);
  const body = prepareTaskBody(props.task.description, presupuestoId);

  return (
    <ScreenContent>
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle title={displayTitle} />
        </View>
      </View>

      <Card style={styles.card}>
        {props.task.contactLabel ? (
          <Text style={styles.meta}>Contacto: {props.task.contactLabel}</Text>
        ) : null}
        {body ? <Text style={styles.body}>{body}</Text> : null}
        {presupuestoId && props.onOpenPresupuesto ? (
          <Pressable
            onPress={() => props.onOpenPresupuesto?.(presupuestoId)}
            style={styles.presupuestoRow}
          >
            <Text style={styles.meta}>Presupuesto</Text>
            <Text style={styles.linkText}>{presupuestoId}</Text>
          </Pressable>
        ) : null}
        {props.task.dueAt ? (
          <Text style={styles.meta}>
            Vence{' '}
            {new Date(props.task.dueAt).toLocaleString('es-AR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </Text>
        ) : null}
        <Text style={styles.meta}>Estado: {statusLabel(props.task.status)}</Text>
        <Text style={styles.meta}>Tipo: {taskTypeLabel(props.task.taskType)}</Text>
      </Card>

      <View style={styles.actions}>
        {props.task.conversationId ? (
          <Pressable onPress={() => props.onOpenConversation(props.task.conversationId!)}>
            <Text style={styles.linkText}>Abrir conversacion</Text>
          </Pressable>
        ) : null}
        <Pressable disabled={props.isSaving} onPress={() => void props.onSnoozeTask()}>
          <Text style={styles.actionText}>Posponer 24 h</Text>
        </Pressable>
        <Pressable disabled={props.isSaving} onPress={() => void props.onCompleteTask()}>
          <Text style={styles.actionTextPrimary}>Marcar como hecho</Text>
        </Pressable>
      </View>
    </ScreenContent>
  );
}

function statusLabel(status: OwnerTask['status']): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'snoozed':
      return 'Pospuesta';
    case 'completed':
      return 'Completada';
    case 'cancelled':
      return 'Cancelada';
  }
}

function taskTypeLabel(taskType: OwnerTask['taskType']): string {
  switch (taskType) {
    case 'follow_up':
      return 'Seguimiento';
    case 'manual':
      return 'Manual';
    case 'copi':
      return 'Copi';
    case 'inventory':
      return 'Inventario';
    case 'callback':
      return 'Callback';
  }
}

const styles = StyleSheet.create({
  actionText: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '500',
  },
  actionTextPrimary: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 4,
  },
  backPressable: {
    paddingRight: 4,
    paddingVertical: 2,
  },
  backText: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
  body: {
    color: colors.navy,
    fontSize: 15,
    lineHeight: 20,
  },
  card: {
    gap: 8,
    padding: 16,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: colors.slate,
    fontSize: 15,
  },
  presupuestoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
