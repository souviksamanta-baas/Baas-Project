import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrganizationMember } from '../api/accountLifecycle';
import { TaskActionsMenu, resolveTaskPermissions } from '../components/TaskActionsMenu';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { prepareTaskBody } from '../lib/taskDetail';
import { compactTaskTitle } from '../lib/workQueue';
import type { OwnerTask } from '../types/tasks';
import { colors } from '../theme';

export function TaskDetailScreen(props: {
  currentUserId: string | null;
  isSaving?: boolean;
  members: OrganizationMember[];
  onBack: () => void;
  onCancelTask: () => Promise<void>;
  onCompleteTask: () => Promise<void>;
  onCreateAppointment: (startsAt: Date) => Promise<void>;
  onFollowTask: () => Promise<void>;
  onOpenConversation: (conversationId: string) => void;
  onOpenPresupuesto?: (quoteId: string) => void;
  onPostponeTask: (postponedUntil: Date) => Promise<void>;
  onReassignTask: (userId: string) => Promise<void>;
  onSnoozeReminder: (minutes: number) => Promise<void>;
  onStartTask: () => Promise<void>;
  onUnfollowTask: () => Promise<void>;
  role: 'owner' | 'co_owner' | 'manager' | 'staff' | undefined;
  task: OwnerTask;
}): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const presupuestoId = props.task.presupuestoId;
  const displayTitle = compactTaskTitle(props.task.title);
  const body = prepareTaskBody(props.task.description, presupuestoId);
  const permissions = useMemo(
    () =>
      resolveTaskPermissions({
        currentUserId: props.currentUserId,
        role: props.role,
        task: props.task,
      }),
    [props.currentUserId, props.role, props.task],
  );

  return (
    <ScreenContent>
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title={displayTitle} />
        </View>
        <Pressable
          accessibilityLabel="Más acciones"
          accessibilityRole="button"
          disabled={props.isSaving}
          hitSlop={8}
          onPress={() => setMenuOpen(true)}
          style={styles.menuPressable}
        >
          <Text style={styles.menuText}>⋮</Text>
        </Pressable>
      </View>

      <Card style={styles.card}>
        {props.task.contactLabel ? (
          <Text style={styles.meta}>Contacto: {props.task.contactLabel}</Text>
        ) : null}
        {props.task.assigneeLabel ? (
          <Text style={styles.meta}>Asignada a: {props.task.assigneeLabel}</Text>
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
        {props.task.postponedUntil ? (
          <Text style={styles.meta}>
            Pospuesta hasta{' '}
            {new Date(props.task.postponedUntil).toLocaleString('es-AR', {
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
            <Text style={styles.linkText}>Abrir conversación</Text>
          </Pressable>
        ) : null}
        {permissions.canManage ? (
          <Pressable disabled={props.isSaving} onPress={() => void props.onCompleteTask()}>
            <Text style={styles.actionTextPrimary}>Marcar como hecho</Text>
          </Pressable>
        ) : null}
      </View>

      <TaskActionsMenu
        members={props.members}
        onCancelTask={() => void props.onCancelTask()}
        onClose={() => setMenuOpen(false)}
        onCompleteTask={() => void props.onCompleteTask()}
        onCreateAppointment={(startsAt) => void props.onCreateAppointment(startsAt)}
        onPostponeTask={(postponedUntil) => void props.onPostponeTask(postponedUntil)}
        onReassignTask={(userId) => void props.onReassignTask(userId)}
        onSnoozeReminder={(minutes) => void props.onSnoozeReminder(minutes)}
        onStartTask={() => void props.onStartTask()}
        onToggleFollow={() =>
          void (props.task.isFollowing ? props.onUnfollowTask() : props.onFollowTask())
        }
        permissions={permissions}
        task={props.task}
        visible={menuOpen}
      />
    </ScreenContent>
  );
}

function statusLabel(status: OwnerTask['status']): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'in_progress':
      return 'En curso';
    case 'postponed':
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
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  card: {
    gap: 6,
    marginBottom: 16,
    padding: 16,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  menuPressable: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuText: {
    color: colors.slate,
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    color: colors.slate,
    fontSize: 14,
  },
  presupuestoRow: {
    gap: 2,
    marginBottom: 4,
  },
});
