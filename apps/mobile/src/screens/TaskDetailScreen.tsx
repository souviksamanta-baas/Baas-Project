import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import type { OwnerTask } from '../types/tasks';
import { colors } from '../theme';

export function TaskDetailScreen(props: {
  isSaving?: boolean;
  onBack: () => void;
  onCompleteTask: () => Promise<void>;
  onOpenConversation: (conversationId: string) => void;
  onSnoozeTask: () => Promise<void>;
  task: OwnerTask;
}): ReactElement {
  return (
    <ScreenContent>
      <View style={styles.headerRow}>
        <Pressable onPress={props.onBack}>
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
      </View>

      <ScreenTitle subtitle="Detalle del seguimiento o tarea" title={props.task.title} />

      <Card style={styles.card}>
        {props.task.contactLabel ? (
          <Text style={styles.meta}>Contacto: {props.task.contactLabel}</Text>
        ) : null}
        {props.task.description ? <Text style={styles.body}>{props.task.description}</Text> : null}
        {props.task.dueAt ? (
          <Text style={styles.meta}>
            Vence {new Date(props.task.dueAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
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
    gap: 16,
    paddingHorizontal: 4,
  },
  backText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    color: colors.navy,
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    gap: 8,
    padding: 16,
  },
  headerRow: {
    marginBottom: 4,
  },
  linkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    color: colors.slate,
    fontSize: 11,
  },
});
