import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { OrganizationMember } from '../api/accountLifecycle';
import { InventoryDateField } from '../components/ProductEditFormFields';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { GhostButton, PrimaryButton, TextField, colors, radius, spacing } from '../design-system';
import { formatDateInput, parseDateInput } from '../lib/addStockForm';

type AmPm = 'AM' | 'PM';

export function NewTaskScreen(props: {
  currentUserId: string | null;
  isSaving?: boolean;
  members: OrganizationMember[];
  onBack: () => void;
  onCreate: (input: {
    assignedToUserId: string;
    description: string;
    dueAt: Date;
    title: string;
  }) => Promise<void>;
}): ReactElement {
  const initialDue = useMemo(() => roundToNextHalfHour(new Date()), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);
  const [dateText, setDateText] = useState(() => formatDateInput(initialDue));
  const [timeText, setTimeText] = useState(() => formatTime12h(initialDue));
  const [amPm, setAmPm] = useState<AmPm>(() => (initialDue.getHours() >= 12 ? 'PM' : 'AM'));
  const [amPmOpen, setAmPmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (assignedToUserId || props.members.length === 0) {
      return;
    }
    const self = props.currentUserId
      ? props.members.find((member) => member.userId === props.currentUserId)
      : null;
    setAssignedToUserId(self?.userId ?? props.members[0]!.userId);
  }, [assignedToUserId, props.currentUserId, props.members]);

  const selectedMember = useMemo(
    () => props.members.find((member) => member.userId === assignedToUserId) ?? null,
    [assignedToUserId, props.members],
  );

  async function handleSubmit(): Promise<void> {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setErrorMessage('Ingresá un título.');
      return;
    }
    if (!trimmedDescription) {
      setErrorMessage('Ingresá el asunto o detalle de la tarea.');
      return;
    }
    if (!assignedToUserId) {
      setErrorMessage('Elegí a quién asignar la tarea.');
      return;
    }

    const dueAt = composeDueAt(dateText, timeText, amPm);
    if (!dueAt) {
      setErrorMessage('Revisá la fecha y la hora (ej. 24/08/2026 y 6:30).');
      return;
    }

    setErrorMessage(null);
    await props.onCreate({
      assignedToUserId,
      description: trimmedDescription,
      dueAt,
      title: trimmedTitle,
    });
  }

  return (
    <ScreenContent title="Nueva tarea">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Nueva tarea" />
        </View>
      </View>

      <Card style={styles.formCard}>
        <TextField
          label="Título"
          onChangeText={setTitle}
          placeholder="Ej. Llamar al cliente"
          value={title}
        />
        <TextField
          label="Asunto"
          multiline
          onChangeText={setDescription}
          placeholder="Detalle de lo que hay que hacer"
          value={description}
        />

        <Text style={styles.sectionLabel}>Vence</Text>
        <View style={styles.dueRow}>
          <View style={styles.dueDate}>
            <InventoryDateField label="" onChange={setDateText} value={dateText} />
          </View>
          <TextInput
            accessibilityLabel="Hora"
            keyboardType="numbers-and-punctuation"
            onChangeText={setTimeText}
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
                      setAmPm(option);
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

        <Text style={styles.sectionLabel}>Asignar a</Text>
        <Pressable
          onPress={() => setPickerOpen((open) => !open)}
          style={({ pressed }) => [styles.assigneeButton, pressed && styles.assigneeButtonPressed]}
        >
          <Text style={styles.assigneeName}>
            {selectedMember?.displayName ?? 'Elegir miembro'}
          </Text>
          <Text style={styles.assigneeHint}>{pickerOpen ? 'Cerrar' : 'Cambiar'}</Text>
        </Pressable>

        {pickerOpen ? (
          <ScrollView style={styles.memberList}>
            {props.members.map((member) => (
              <Pressable
                key={member.userId}
                onPress={() => {
                  setAssignedToUserId(member.userId);
                  setPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.memberRow,
                  member.userId === assignedToUserId && styles.memberRowActive,
                  pressed && styles.assigneeButtonPressed,
                ]}
              >
                <Text style={styles.memberName}>{member.displayName}</Text>
                {member.email ? <Text style={styles.memberMeta}>{member.email}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.actionsRow}>
          <GhostButton label="Cancelar" onPress={props.onBack} />
          {props.isSaving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <PrimaryButton label="Crear tarea" onPress={() => void handleSubmit()} />
          )}
        </View>
      </Card>
    </ScreenContent>
  );
}

function roundToNextHalfHour(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const remainder = minutes % 30;
  if (remainder !== 0) {
    next.setMinutes(minutes + (30 - remainder));
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

const styles = StyleSheet.create({
  actionsRow: {
    alignItems: 'center',
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
  assigneeButton: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  assigneeButtonPressed: {
    backgroundColor: colors.surfaceMint,
  },
  assigneeHint: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  assigneeName: {
    color: colors.navy,
    flex: 1,
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
  dueDate: {
    flex: 1,
    minWidth: 0,
  },
  dueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 5,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  formCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  memberList: {
    maxHeight: 220,
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
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  memberRowActive: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  sectionLabel: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
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
