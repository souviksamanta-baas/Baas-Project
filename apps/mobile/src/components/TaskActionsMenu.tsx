import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icons';
import type { IconKind } from './icons';
import { InventoryDateField } from './ProductEditFormFields';
import type { OrganizationMember } from '../api/accountLifecycle';
import { GhostButton, PrimaryButton, colors, radius, spacing } from '../design-system';
import { useAndroidKeyboardHeight } from '../hooks/useAndroidKeyboard';
import { formatDateInput, parseDateInput } from '../lib/addStockForm';
import type { OwnerTask } from '../types/tasks';

type AmPm = 'AM' | 'PM';

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
  const androidKeyboardHeight = useAndroidKeyboardHeight();

  useEffect(() => {
    if (props.visible) {
      setScreen('root');
      const now = roundToNextStep(new Date());
      setPostponeDate(now);
      setMeetingDate(now);
    }
  }, [props.visible]);

  const sheetBottomPad =
    Math.max(insets.bottom, spacing.md) +
    spacing.sm +
    (Platform.OS === 'android' ? androidKeyboardHeight : 0);

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
          style={[styles.sheet, { paddingBottom: sheetBottomPad }]}
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
  // Same Vence controls as Nueva tarea: DD/MM/YYYY + hora + AM/PM.
  const [dateText, setDateText] = useState(() => formatDateInput(props.date));
  const [timeText, setTimeText] = useState(() => formatTime12h(props.date));
  const [amPm, setAmPm] = useState<AmPm>(() => (props.date.getHours() >= 12 ? 'PM' : 'AM'));
  const [amPmOpen, setAmPmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setDateText(formatDateInput(props.date));
    setTimeText(formatTime12h(props.date));
    setAmPm(props.date.getHours() >= 12 ? 'PM' : 'AM');
    setErrorMessage(null);
  }, [props.date]);

  function applyFields(nextDate: string, nextTime: string, nextAmPm: AmPm): void {
    setDateText(nextDate);
    setTimeText(nextTime);
    setAmPm(nextAmPm);
    const composed = composeDueAt(nextDate, nextTime, nextAmPm);
    if (composed) {
      setErrorMessage(null);
      props.onChange(composed);
    }
  }

  function handleConfirm(): void {
    const composed = composeDueAt(dateText, timeText, amPm);
    if (!composed) {
      setErrorMessage('Revisá la fecha y la hora (ej. 24/08/2026 y 6:30).');
      return;
    }
    props.onChange(composed);
    props.onConfirm();
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetScroll}>
      <Text style={styles.sheetTitle}>{props.title}</Text>

      <View style={styles.dueRow}>
        <View style={styles.dueDate}>
          <InventoryDateField
            label=""
            onChange={(value) => applyFields(value, timeText, amPm)}
            value={dateText}
          />
        </View>
        <TextInput
          accessibilityLabel="Hora"
          keyboardType="numbers-and-punctuation"
          onChangeText={(value) => applyFields(dateText, value, amPm)}
          placeholder="6:30"
          placeholderTextColor={colors.placeholder}
          style={styles.timeInput}
          value={timeText}
        />
        <View style={styles.amPmWrap}>
          <Pressable
            accessibilityLabel="AM o PM"
            onPress={() => setAmPmOpen((open) => !open)}
            style={({ pressed }) => [styles.amPmButton, pressed && styles.amPmButtonPressed]}
          >
            <Text style={styles.amPmText}>{amPm}</Text>
            <Text style={styles.amPmCaret}>{amPmOpen ? '▴' : '▾'}</Text>
          </Pressable>
          {amPmOpen ? (
            <View style={styles.amPmMenu}>
              {(['AM', 'PM'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    applyFields(dateText, timeText, option);
                    setAmPmOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.amPmOption,
                    option === amPm && styles.amPmOptionActive,
                    pressed && styles.amPmButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.amPmOptionText,
                      option === amPm && styles.amPmOptionTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.actionsRow}>
        <GhostButton label="Cancelar" onPress={props.onCancel} />
        <PrimaryButton label={props.submitLabel} onPress={handleConfirm} />
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

function formatTime12h(date: Date): string {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours12}:${minutes}`;
}

function composeDueAt(dateText: string, timeText: string, amPm: AmPm): Date | null {
  const date = parseDateInput(dateText);
  if (!date) {
    return null;
  }

  const match = /^(\d{1,2})\s*[:.]\s*(\d{1,2})$/.exec(timeText.trim());
  if (!match) {
    return null;
  }

  let hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  if (amPm === 'AM') {
    hours = hours === 12 ? 0 : hours;
  } else {
    hours = hours === 12 ? 12 : hours + 12;
  }

  const dueAt = new Date(date);
  dueAt.setHours(hours, minutes, 0, 0);
  return dueAt;
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
  amPmButton: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  amPmButtonPressed: {
    backgroundColor: colors.surfaceMint,
  },
  amPmCaret: {
    color: colors.slate,
    fontSize: 12,
  },
  amPmMenu: {
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: '100%',
    zIndex: 20,
  },
  amPmOption: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  amPmOptionActive: {
    backgroundColor: colors.primarySoft,
  },
  amPmOptionText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  amPmOptionTextActive: {
    color: colors.primaryDark,
  },
  amPmText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  amPmWrap: {
    minWidth: 72,
    position: 'relative',
    zIndex: 10,
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  dueDate: {
    flex: 1,
    minWidth: 0,
  },
  dueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    zIndex: 5,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 14,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.sm,
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
  sheetScroll: {
    overflow: 'visible',
  },
  sheetTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  timeInput: {
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 40,
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 11,
    textAlign: 'center',
  },
});
