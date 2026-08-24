import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { OrganizationMember } from '../api/accountLifecycle';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { GhostButton, PrimaryButton, TextField, colors, radius, spacing } from '../design-system';

const DUE_STEP_MINUTES = 30;

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<Date>(() => roundToNextStep(new Date()));
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
        <Text style={styles.dateLine}>
          {capitalize(
            dueAt.toLocaleString('es-AR', {
              dateStyle: 'full',
              timeStyle: 'short',
            }),
          )}
        </Text>
        <View style={styles.stepperRow}>
          <Text style={styles.stepperLabel}>Día</Text>
          <View style={styles.stepper}>
            <Pressable hitSlop={8} onPress={() => setDueAt(addMinutes(dueAt, -60 * 24))}>
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>
              {dueAt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
            </Text>
            <Pressable hitSlop={8} onPress={() => setDueAt(addMinutes(dueAt, 60 * 24))}>
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.stepperRow}>
          <Text style={styles.stepperLabel}>Hora</Text>
          <View style={styles.stepper}>
            <Pressable hitSlop={8} onPress={() => setDueAt(addMinutes(dueAt, -DUE_STEP_MINUTES))}>
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>
              {dueAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Pressable hitSlop={8} onPress={() => setDueAt(addMinutes(dueAt, DUE_STEP_MINUTES))}>
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
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

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function roundToNextStep(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const remainder = minutes % DUE_STEP_MINUTES;
  if (remainder !== 0) {
    next.setMinutes(minutes + (DUE_STEP_MINUTES - remainder));
  }
  return next;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
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
  dateLine: {
    color: colors.slate,
    fontSize: 14,
    marginBottom: spacing.sm,
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
    marginBottom: spacing.xs,
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
