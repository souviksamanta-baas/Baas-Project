import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icons';
import type { IconKind } from './icons';
import type { OrganizationMember } from '../api/accountLifecycle';
import { GhostButton, PrimaryButton, colors, radius, spacing } from '../design-system';
import type { OwnerTask } from '../types/tasks';

export interface TaskActionPermissions {
  /** Can start/complete/postpone/reassign/cancel (assignee or owner/co-owner). */
  canManage: boolean;
  /** Owner or co-owner (org role). */
  isOwnerRole: boolean;
}

export interface TaskActionsMenuProps {
  members: OrganizationMember[];
  onClose: () => void;
  onCancelTask: () => void;
  onCompleteTask: () => void;
  onCreateAppointment: (startsAt: Date) => void;
  onPostponeTask: (postponedUntil: Date) => void;
  onReassignTask: (userId: string) => void;
  onSnoozeReminder: (minutes: number) => void;
  onStartTask: () => void;
  onToggleFollow: () => void;
  permissions: TaskActionPermissions;
  task: OwnerTask;
  visible: boolean;
}

type Screen =
  | 'root'
  | 'postpone'
  | 'meeting'
  | 'reassign';

const POSTPONE_STEP_MINUTES = 30;

export function TaskActionsMenu(props: TaskActionsMenuProps): ReactElement {
  const [screen, setScreen] = useState<Screen>('root');
  const [postponeDate, setPostponeDate] = useState<Date>(() => roundToNextStep(new Date()));
  const [meetingDate, setMeetingDate] = useState<Date>(() => roundToNextStep(new Date()));
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (props.visible) {
      setScreen('root');
      const now = roundToNextStep(new Date());
      setPostponeDate(now);
      setMeetingDate(now);
    }
  }, [props.visible]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={props.onClose}
      transparent
      visible={props.visible}
    >
      <Pressable onPress={props.onClose} style={styles.backdrop}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
          ]}
        >
          <View style={styles.handle} />
          {screen === 'root' ? (
            <RootMenu
              onSelectMeeting={() => setScreen('meeting')}
              onSelectPostpone={() => setScreen('postpone')}
              onSelectReassign={() => setScreen('reassign')}
              {...props}
            />
          ) : null}
          {screen === 'postpone' ? (
            <DateTimeSheet
              date={postponeDate}
              onCancel={() => setScreen('root')}
              onChange={setPostponeDate}
              onConfirm={() => {
                props.onPostponeTask(postponeDate);
                props.onClose();
              }}
              submitLabel="Posponer"
              title="Posponer hasta"
            />
          ) : null}
          {screen === 'meeting' ? (
            <DateTimeSheet
              date={meetingDate}
              onCancel={() => setScreen('root')}
              onChange={setMeetingDate}
              onConfirm={() => {
                props.onCreateAppointment(meetingDate);
                props.onClose();
              }}
              submitLabel="Crear reunión"
              title="Crear reunión"
            />
          ) : null}
          {screen === 'reassign' ? (
            <ReassignSheet
              members={props.members}
              onCancel={() => setScreen('root')}
              onSelect={(userId) => {
                props.onReassignTask(userId);
                props.onClose();
              }}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RootMenu(props: {
  onCancelTask: () => void;
  onClose: () => void;
  onCompleteTask: () => void;
  onSelectMeeting: () => void;
  onSelectPostpone: () => void;
  onSelectReassign: () => void;
  onSnoozeReminder: (minutes: number) => void;
  onStartTask: () => void;
  onToggleFollow: () => void;
  permissions: TaskActionPermissions;
  task: OwnerTask;
}): ReactElement {
  const canManage = props.permissions.canManage;

  return (
    <ScrollView>
      <Text style={styles.sheetTitle}>Acciones de la tarea</Text>

      <MenuRow
        icon={props.task.isFollowing ? 'bell' : 'bell'}
        onPress={() => {
          props.onToggleFollow();
          props.onClose();
        }}
        title={props.task.isFollowing ? 'Dejar de seguir' : 'Seguir'}
      />

      <MenuRow
        icon="calendar"
        onPress={props.onSelectMeeting}
        title="Crear reunión"
      />

      {canManage ? (
        <>
          <MenuRow
            icon="clock"
            onPress={props.onSelectPostpone}
            title="Posponer hasta…"
          />
          <MenuRow
            icon="mic"
            onPress={() => {
              props.onSnoozeReminder(10);
              props.onClose();
            }}
            title="Silenciar recordatorio 10 min"
          />
          <MenuRow
            icon="clock"
            onPress={() => {
              props.onStartTask();
              props.onClose();
            }}
            title="En curso"
          />
          <MenuRow
            icon="check"
            onPress={() => {
              props.onCompleteTask();
              props.onClose();
            }}
            title="Hecho"
          />
          <MenuRow icon="users" onPress={props.onSelectReassign} title="Reasignar" />
          <MenuRow
            danger
            icon="trash"
            onPress={() => {
              props.onCancelTask();
              props.onClose();
            }}
            title="Eliminar"
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function MenuRow(props: {
  danger?: boolean;
  icon: IconKind;
  onPress: () => void;
  title: string;
}): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
      <Icon
        color={props.danger ? colors.danger : colors.primary}
        kind={props.icon}
        size={22}
        strokeWidth={1.8}
      />
      <Text style={[styles.menuRowText, props.danger && styles.menuRowTextDanger]}>
        {props.title}
      </Text>
    </Pressable>
  );
}

function DateTimeSheet(props: {
  date: Date;
  onCancel: () => void;
  onChange: (date: Date) => void;
  onConfirm: () => void;
  submitLabel: string;
  title: string;
}): ReactElement {
  const dateLabel = props.date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });
  const timeLabel = props.date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.sheetTitle}>{props.title}</Text>
      <Text style={styles.dateLine}>{capitalize(dateLabel)}</Text>

      <View style={styles.stepperRow}>
        <Text style={styles.stepperLabel}>Día</Text>
        <View style={styles.stepper}>
          <Pressable
            hitSlop={8}
            onPress={() => props.onChange(addMinutes(props.date, -60 * 24))}
          >
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>
            {props.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => props.onChange(addMinutes(props.date, 60 * 24))}
          >
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.stepperRow}>
        <Text style={styles.stepperLabel}>Hora</Text>
        <View style={styles.stepper}>
          <Pressable
            hitSlop={8}
            onPress={() => props.onChange(addMinutes(props.date, -POSTPONE_STEP_MINUTES))}
          >
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{timeLabel}</Text>
          <Pressable
            hitSlop={8}
            onPress={() => props.onChange(addMinutes(props.date, POSTPONE_STEP_MINUTES))}
          >
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <GhostButton label="Cancelar" onPress={props.onCancel} />
        <PrimaryButton label={props.submitLabel} onPress={props.onConfirm} />
      </View>
    </ScrollView>
  );
}

function ReassignSheet(props: {
  members: OrganizationMember[];
  onCancel: () => void;
  onSelect: (userId: string) => void;
}): ReactElement {
  const items = useMemo(() => props.members, [props.members]);

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.sheetTitle}>Reasignar tarea</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No hay miembros disponibles.</Text>
      ) : null}
      {items.map((member) => (
        <Pressable
          key={member.userId}
          onPress={() => props.onSelect(member.userId)}
          style={({ pressed }) => [styles.memberRow, pressed && styles.menuRowPressed]}
        >
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>{initials(member.displayName)}</Text>
          </View>
          <View style={styles.memberBody}>
            <Text style={styles.memberName}>{member.displayName}</Text>
            {member.email ? <Text style={styles.memberMeta}>{member.email}</Text> : null}
          </View>
        </Pressable>
      ))}
      <View style={styles.actionsRow}>
        <GhostButton label="Volver" onPress={props.onCancel} />
      </View>
    </ScrollView>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function roundToNextStep(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const remainder = minutes % POSTPONE_STEP_MINUTES;
  if (remainder !== 0) {
    next.setMinutes(minutes + (POSTPONE_STEP_MINUTES - remainder));
  }
  return next;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

/** Resolve whether the current user may manage a task (start/postpone/complete). */
export function resolveTaskPermissions(params: {
  currentUserId: string | null;
  role: 'owner' | 'co_owner' | 'manager' | 'staff' | undefined;
  task: OwnerTask;
}): TaskActionPermissions {
  const isOwnerRole = params.role === 'owner' || params.role === 'co_owner';
  const isAssignee =
    params.currentUserId != null && params.task.assignedToUserId === params.currentUserId;
  return {
    canManage: isOwnerRole || isAssignee,
    isOwnerRole,
  };
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  dateLine: {
    color: colors.slate,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 14,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.borderInput,
    borderRadius: 999,
    height: 4,
    marginBottom: spacing.md,
    width: 40,
  },
  memberAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  memberAvatarText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
  },
  memberMeta: {
    color: colors.slate,
    fontSize: 12,
    marginTop: 2,
  },
  memberName: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  memberRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 14,
  },
  menuRowPressed: {
    backgroundColor: colors.surfaceMint,
  },
  menuRowText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '500',
  },
  menuRowTextDanger: {
    color: colors.danger,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '86%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  stepper: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    minWidth: 140,
    paddingHorizontal: spacing.sm,
  },
  stepperLabel: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stepperText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '500',
    paddingHorizontal: spacing.sm,
  },
  stepperValue: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
});
