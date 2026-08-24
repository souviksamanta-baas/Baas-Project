import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { OrganizationMember } from '../api/accountLifecycle';
import { Icon } from '../components/icons';
import { TaskActionsMenu, resolveTaskPermissions } from '../components/TaskActionsMenu';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { prepareTaskBody } from '../lib/taskDetail';
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
  const body = prepareTaskBody(props.task.description, presupuestoId);
  const fullDescription = props.task.description?.trim() || body;
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
    <ScreenContent disableScroll>
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Detalle de tarea" />
        </View>
        <Pressable
          accessibilityLabel="Más acciones"
          accessibilityRole="button"
          disabled={props.isSaving}
          hitSlop={8}
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.menuPressable, pressed && styles.menuPressablePressed]}
        >
          <Icon color={colors.slate} kind="dots-vertical" size={22} strokeWidth={1.8} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
      >
        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>Título</Text>
          <Text style={styles.title}>{props.task.title}</Text>

          <Text style={styles.sectionLabel}>Asunto</Text>
          <Text style={styles.body}>
            {fullDescription?.trim() ? fullDescription : 'Sin detalle'}
          </Text>

          <View style={styles.metaBlock}>
            <Text style={styles.meta}>Estado: {statusLabel(props.task.status)}</Text>
            {props.task.assigneeLabel ? (
              <Text style={styles.meta}>Asignada a: {props.task.assigneeLabel}</Text>
            ) : null}
            {props.task.contactLabel ? (
              <Text style={styles.meta}>Contacto: {props.task.contactLabel}</Text>
            ) : null}
            {props.task.dueAt ? (
              <Text style={styles.meta}>
                Vence{' '}
                {new Date(props.task.dueAt).toLocaleString('es-AR', {
                  dateStyle: 'full',
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
            <Text style={styles.meta}>Tipo: {taskTypeLabel(props.task.taskType)}</Text>
            {props.task.isFollowing ? (
              <Text style={styles.meta}>Estás siguiendo esta tarea</Text>
            ) : null}
          </View>

          {presupuestoId && props.onOpenPresupuesto ? (
            <Pressable
              onPress={() => props.onOpenPresupuesto?.(presupuestoId)}
              style={styles.presupuestoRow}
            >
              <Text style={styles.sectionLabel}>Presupuesto</Text>
              <Text style={styles.linkText}>{presupuestoId}</Text>
            </Pressable>
          ) : null}
        </Card>

        <View style={styles.quickActions}>
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
      </ScrollView>

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
    marginBottom: 8,
    padding: 20,
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
  menuPressable: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  menuPressablePressed: {
    backgroundColor: colors.surfaceMint,
    borderRadius: 999,
  },
  meta: {
    color: colors.slate,
    fontSize: 14,
    lineHeight: 20,
  },
  metaBlock: {
    gap: 6,
    marginBottom: 8,
  },
  presupuestoRow: {
    gap: 4,
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 4,
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
