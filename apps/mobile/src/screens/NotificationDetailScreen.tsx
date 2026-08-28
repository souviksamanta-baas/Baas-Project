import type { ReactElement } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { formatWorkQueueTime } from '../lib/workQueue';
import type { OwnerNotification } from '../types/tasks';
import { colors } from '../theme';

export function NotificationDetailScreen(props: {
  isSaving?: boolean;
  notification: OwnerNotification;
  onBack: () => void;
  onConfirmCopiAction?: (actionId: string) => Promise<void>;
  onDismiss: () => Promise<void>;
  onOpenProduct?: (productId: string) => void;
  onOpenTask?: (taskId: string) => void;
}): ReactElement {
  const [isConfirming, setIsConfirming] = useState(false);
  const productId = props.notification.productId ?? props.notification.payload.productId ?? null;
  const taskId = props.notification.payload.taskId ?? null;
  const actionId = props.notification.payload.actionId ?? null;
  const isCopiConfirm =
    props.notification.notificationType === 'copi.action_needed' && Boolean(actionId);
  const createdLabel = formatFullTimestamp(props.notification.createdAt);
  const detailTitle =
    (typeof props.notification.payload.title === 'string' &&
      props.notification.payload.title.trim()) ||
    null;
  const detailDescription =
    (typeof props.notification.payload.description === 'string' &&
      props.notification.payload.description.trim()) ||
    null;
  const detailDueAt =
    typeof props.notification.payload.dueAt === 'string' ? props.notification.payload.dueAt : null;
  const detailAssignee =
    (typeof props.notification.payload.assigneeName === 'string' &&
      props.notification.payload.assigneeName.trim()) ||
    null;

  return (
    <ScreenContent disableScroll>
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Detalle de notificación" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
      >
        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>Título</Text>
          <Text style={styles.title}>{props.notification.title}</Text>

          <Text style={styles.sectionLabel}>Mensaje</Text>
          <Text style={styles.body}>
            {props.notification.body?.trim() ? props.notification.body : 'Sin detalle'}
          </Text>

          {isCopiConfirm ? (
            <View style={styles.proposalBlock}>
              <Text style={styles.sectionLabel}>Detalle de la tarea</Text>
              {detailTitle ? <Text style={styles.proposalTitle}>{detailTitle}</Text> : null}
              {detailDescription ? <Text style={styles.body}>{detailDescription}</Text> : null}
              <View style={styles.metaBlock}>
                {detailAssignee ? (
                  <Text style={styles.meta}>Asignada a: {detailAssignee}</Text>
                ) : null}
                {detailDueAt ? (
                  <Text style={styles.meta}>Vence: {formatFullTimestamp(detailDueAt)}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.metaBlock}>
            <Text style={styles.meta}>Tipo: {typeLabel(props.notification.notificationType)}</Text>
            <Text style={styles.meta}>Estado: {statusLabel(props.notification.status)}</Text>
            {createdLabel ? <Text style={styles.meta}>Recibida: {createdLabel}</Text> : null}
            {props.notification.productLabel ? (
              <Text style={styles.meta}>Producto: {props.notification.productLabel}</Text>
            ) : null}
          </View>
        </Card>

        <View style={styles.actions}>
          {isCopiConfirm && props.onConfirmCopiAction && actionId ? (
            <Pressable
              disabled={props.isSaving || isConfirming}
              onPress={() => {
                setIsConfirming(true);
                void props
                  .onConfirmCopiAction?.(actionId)
                  .catch(() => undefined)
                  .finally(() => setIsConfirming(false));
              }}
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && styles.confirmButtonPressed,
                (props.isSaving || isConfirming) && styles.confirmButtonDisabled,
              ]}
            >
              {isConfirming ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.confirmButtonText}>Confirmar creación</Text>
              )}
            </Pressable>
          ) : null}
          {taskId && props.onOpenTask ? (
            <Pressable onPress={() => props.onOpenTask?.(taskId)}>
              <Text style={styles.linkText}>Ver tarea</Text>
            </Pressable>
          ) : null}
          {productId && props.onOpenProduct ? (
            <Pressable onPress={() => props.onOpenProduct?.(productId)}>
              <Text style={styles.linkText}>Ver producto</Text>
            </Pressable>
          ) : null}
          {props.notification.status !== 'dismissed' ? (
            <Pressable
              disabled={props.isSaving || isConfirming}
              onPress={() => {
                void props.onDismiss();
              }}
            >
              <Text style={styles.dismissText}>Descartar</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContent>
  );
}

function formatFullTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatWorkQueueTime(value);
  }
  return date.toLocaleString('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function statusLabel(status: OwnerNotification['status']): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'sent':
      return 'Enviada';
    case 'failed':
      return 'Fallida';
    case 'dismissed':
      return 'Descartada';
  }
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    'copi.action_needed': 'Copi necesita confirmación',
    'stock.low': 'Stock bajo',
    low_stock: 'Stock bajo',
    'task.assigned': 'Tarea asignada',
    'task.reminder': 'Recordatorio de tarea',
    'task.overdue': 'Tarea vencida',
    'task.status_changed': 'Cambio de estado',
    'task.postpone_wake': 'Tarea reactivada',
    'task.snooze_wake': 'Tarea reactivada',
    'team.invite_accepted': 'Miembro se unió',
  };
  return labels[type] ?? type;
}

const styles = StyleSheet.create({
  actions: {
    gap: 14,
    paddingHorizontal: 4,
  },
  backPressable: {
    marginRight: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  backText: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  body: {
    color: colors.navy,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  card: {
    padding: 22,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonPressed: {
    opacity: 0.88,
  },
  confirmButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  dismissText: {
    color: colors.slate,
    fontSize: 15,
    fontWeight: '600',
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: colors.slate,
    fontSize: 14,
    lineHeight: 20,
  },
  metaBlock: {
    gap: 6,
  },
  proposalBlock: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    marginBottom: 16,
    paddingTop: 16,
  },
  proposalTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  sectionLabel: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 16,
  },
});
