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

import { ActionRow, Card, ScreenContent, ScreenTitle } from '../components/ui';
import { MobileContainedModal } from '../components/MobileContainedModal';
import { Icon } from '../components/icons';
import { GhostButton, PrimaryButton, TextField } from '../design-system';
import { normalizeEmail } from '../services/email';
import type { Appointment, AppointmentInput, AppointmentOrganizer } from '../types/appointments';
import { colors } from '../theme';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 36;
const TIME_GUTTER = 56;
const DEFAULT_DURATION_MINUTES = 30;

type ComposeDraft = {
  endsAt: Date;
  fromUserId: string | null;
  notes: string;
  startsAt: Date;
  title: string;
  toEmail: string;
};

export function AppointmentsScreen(props: {
  appointments: Appointment[];
  currentUserId?: string | null;
  isLoading?: boolean;
  isSaving?: boolean;
  now?: Date;
  onCreateAppointment: (input: AppointmentInput) => Promise<unknown>;
  onOpenAppointment: (appointmentId: string) => void;
  onOpenCopi?: () => void;
  organizers?: AppointmentOrganizer[];
}): ReactElement {
  const now = props.now ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(now));
  const [draft, setDraft] = useState<ComposeDraft | null>(null);

  const daysWithAppointments = useMemo(() => {
    const keys = new Set<string>();
    for (const appointment of props.appointments) {
      if (appointment.status === 'cancelled') {
        continue;
      }
      keys.add(dayKey(new Date(appointment.startsAt)));
    }
    return keys;
  }, [props.appointments]);

  const dayAppointments = useMemo(
    () =>
      props.appointments
        .filter((appointment) => isSameDay(new Date(appointment.startsAt), selectedDate))
        .sort(
          (left, right) =>
            new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
        ),
    [props.appointments, selectedDate],
  );

  const monthLabel = visibleMonth.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
  const selectedDayLabel = selectedDate.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });

  const organizers = useMemo(
    () =>
      withCurrentOrganizer(props.organizers ?? [], props.currentUserId ?? null),
    [props.currentUserId, props.organizers],
  );

  function openCompose(startsAt: Date): void {
    const endsAt = addMinutes(startsAt, DEFAULT_DURATION_MINUTES);
    setDraft({
      endsAt,
      fromUserId: props.currentUserId ?? organizers[0]?.userId ?? null,
      notes: '',
      startsAt,
      title: '',
      toEmail: '',
    });
  }

  async function saveDraft(): Promise<void> {
    if (!draft) {
      return;
    }
    const title = draft.title.trim();
    if (!title) {
      return;
    }
    if (draft.endsAt.getTime() <= draft.startsAt.getTime()) {
      return;
    }
    const attendeeEmail = draft.toEmail.trim() ? normalizeEmail(draft.toEmail) : null;
    if (draft.toEmail.trim() && !attendeeEmail) {
      return;
    }

    const organizer = organizers.find((member) => member.userId === draft.fromUserId) ?? null;
    const created = await props.onCreateAppointment({
      assignedToUserId: draft.fromUserId,
      attendeeEmail,
      endsAt: draft.endsAt.toISOString(),
      fromLabel: organizerLabel(organizer, props.currentUserId ?? null, false),
      notes: draft.notes.trim() || null,
      startsAt: draft.startsAt.toISOString(),
      title,
    });
    if (created) {
      setDraft(null);
    }
  }

  return (
    <ScreenContent title="Agenda">
      <ScreenTitle title="Agenda" />

      {props.onOpenCopi ? (
        <Card flush>
          <ActionRow
            icon="message"
            onPress={props.onOpenCopi}
            title="Pedile a Copi que agende un turno"
          />
        </Card>
      ) : null}

      {props.isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      <Card style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityLabel="Mes anterior"
            hitSlop={8}
            onPress={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
            style={styles.monthNav}
          >
            <Icon color={colors.navy} kind="arrow-left" size={16} strokeWidth={2} />
          </Pressable>
          <Text style={styles.monthLabel}>{capitalize(monthLabel)}</Text>
          <Pressable
            accessibilityLabel="Mes siguiente"
            hitSlop={8}
            onPress={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
            style={styles.monthNav}
          >
            <Icon color={colors.navy} kind="chevron-right" size={16} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => {
              const today = startOfDay(now);
              setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedDate(today);
            }}
            style={styles.todayButton}
          >
            <Text style={styles.todayButtonText}>Hoy</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((day) => (
            <Text key={day} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>

        <MonthGrid
          daysWithAppointments={daysWithAppointments}
          onSelectDate={(date) => {
            setSelectedDate(date);
            if (
              date.getMonth() !== visibleMonth.getMonth() ||
              date.getFullYear() !== visibleMonth.getFullYear()
            ) {
              setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
            }
          }}
          selectedDate={selectedDate}
          today={now}
          visibleMonth={visibleMonth}
        />
      </Card>

      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>{capitalize(selectedDayLabel)}</Text>
        <Pressable
          accessibilityLabel="Nuevo turno"
          onPress={() => openCompose(nextHalfHour(selectedDate, now))}
          style={styles.addButton}
        >
          <Icon color={colors.surface} kind="plus" size={14} strokeWidth={2.2} />
        </Pressable>
      </View>

      <Card flush style={styles.dayCard}>
        <DayTimeline
          appointments={dayAppointments}
          now={now}
          onOpenAppointment={props.onOpenAppointment}
          onSelectSlot={openCompose}
          selectedDate={selectedDate}
        />
      </Card>

      <ComposeAppointmentModal
        currentUserId={props.currentUserId ?? null}
        draft={draft}
        isSaving={props.isSaving === true}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={() => void saveDraft()}
        organizers={organizers}
      />
    </ScreenContent>
  );
}

function MonthGrid(props: {
  daysWithAppointments: Set<string>;
  onSelectDate: (date: Date) => void;
  selectedDate: Date;
  today: Date;
  visibleMonth: Date;
}): ReactElement {
  const cells = useMemo(() => monthCells(props.visibleMonth), [props.visibleMonth]);

  return (
    <View style={styles.monthGrid}>
      {cells.map((date) => {
        const inMonth = date.getMonth() === props.visibleMonth.getMonth();
        const selected = isSameDay(date, props.selectedDate);
        const today = isSameDay(date, props.today);
        const hasEvents = props.daysWithAppointments.has(dayKey(date));

        return (
          <Pressable
            key={dayKey(date)}
            onPress={() => props.onSelectDate(date)}
            style={styles.dayCell}
          >
            <View
              style={[
                styles.dayNumberWrap,
                today && !selected && styles.dayToday,
                selected && styles.daySelected,
              ]}
            >
              <Text
                style={[
                  styles.dayNumber,
                  !inMonth && styles.dayMuted,
                  selected && styles.dayNumberSelected,
                  today && !selected && styles.dayNumberToday,
                ]}
              >
                {date.getDate()}
              </Text>
            </View>
            <View
              style={[
                styles.eventDot,
                hasEvents && styles.eventDotVisible,
                selected && hasEvents && styles.eventDotSelected,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function DayTimeline(props: {
  appointments: Appointment[];
  now: Date;
  onOpenAppointment: (appointmentId: string) => void;
  onSelectSlot: (startsAt: Date) => void;
  selectedDate: Date;
}): ReactElement {
  const slots = useMemo(() => {
    const items: Date[] = [];
    for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour += 1) {
      items.push(atHour(props.selectedDate, hour, 0));
      items.push(atHour(props.selectedDate, hour, SLOT_MINUTES));
    }
    return items;
  }, [props.selectedDate]);

  const gridStart = atHour(props.selectedDate, DAY_START_HOUR, 0);
  const gridHeight = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES * SLOT_HEIGHT;
  const nowTop = isSameDay(props.selectedDate, props.now)
    ? ((props.now.getTime() - gridStart.getTime()) / (SLOT_MINUTES * 60_000)) * SLOT_HEIGHT
    : null;

  return (
    <View style={[styles.timeline, { height: gridHeight }]}>
      {slots.map((slot) => {
        const isHour = slot.getMinutes() === 0;
        return (
          <Pressable
            key={slot.toISOString()}
            onPress={() => props.onSelectSlot(slot)}
            style={[styles.slot, isHour && styles.slotHour]}
          >
            <Text style={[styles.slotTime, !isHour && styles.slotTimeHalf]}>
              {isHour ? formatTime(slot) : ''}
            </Text>
            <View style={styles.slotLine} />
          </Pressable>
        );
      })}

      {nowTop != null && nowTop >= 0 && nowTop <= gridHeight ? (
        <View pointerEvents="none" style={[styles.nowMarker, { top: nowTop }]}>
          <View style={styles.nowDot} />
          <View style={styles.nowLine} />
        </View>
      ) : null}

      {props.appointments.map((appointment) => {
        const start = new Date(appointment.startsAt);
        const end = new Date(appointment.endsAt);
        const top = ((start.getTime() - gridStart.getTime()) / (SLOT_MINUTES * 60_000)) * SLOT_HEIGHT;
        const height = Math.max(
          SLOT_HEIGHT - 4,
          ((end.getTime() - start.getTime()) / (SLOT_MINUTES * 60_000)) * SLOT_HEIGHT - 4,
        );
        const clampedTop = Math.max(0, top);
        return (
          <Pressable
            key={appointment.id}
            onPress={() => props.onOpenAppointment(appointment.id)}
            style={[
              styles.eventBlock,
              appointment.status === 'completed' && styles.eventBlockCompleted,
              appointment.status === 'cancelled' && styles.eventBlockCancelled,
              { height, top: clampedTop },
            ]}
          >
            <Text numberOfLines={1} style={styles.eventTitle}>
              {appointment.title}
            </Text>
            <Text numberOfLines={1} style={styles.eventTime}>
              {formatTime(start)} – {formatTime(end)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ComposeAppointmentModal(props: {
  currentUserId: string | null;
  draft: ComposeDraft | null;
  isSaving: boolean;
  onChange: (draft: ComposeDraft | null) => void;
  onClose: () => void;
  onSave: () => void;
  organizers: AppointmentOrganizer[];
}): ReactElement {
  const [titleFocused, setTitleFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);
  const [fromPickerOpen, setFromPickerOpen] = useState(false);

  useEffect(() => {
    if (!props.draft) {
      setTitleFocused(false);
      setToFocused(false);
      setNotesFocused(false);
      setFromPickerOpen(false);
    }
  }, [props.draft]);

  const selectedOrganizer =
    props.organizers.find((member) => member.userId === props.draft?.fromUserId) ?? null;
  const toEmailInvalid =
    Boolean(props.draft?.toEmail.trim()) && normalizeEmail(props.draft?.toEmail ?? '') == null;

  return (
    <MobileContainedModal
      animationType="slide"
      onClose={props.onClose}
      sheetStyle={styles.composeSheet}
      visible={props.draft != null}
    >
      {props.draft ? (
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.composeTitle}>Nuevo turno</Text>
          <Text style={styles.composeDate}>
            {capitalize(
              props.draft.startsAt.toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                weekday: 'long',
              }),
            )}
          </Text>

          <View style={styles.partyField}>
            <Text style={styles.timeLabel}>De</Text>
            <Pressable
              onPress={() => setFromPickerOpen((open) => !open)}
              style={styles.fromButton}
            >
              <Text numberOfLines={1} style={styles.fromValue}>
                {organizerLabel(selectedOrganizer, props.currentUserId, true)}
              </Text>
              <Icon
                color={colors.slate}
                kind={fromPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={12}
                strokeWidth={2}
              />
            </Pressable>
            {fromPickerOpen
              ? props.organizers.map((member) => {
                  const selected = member.userId === props.draft!.fromUserId;
                  return (
                    <Pressable
                      key={member.userId}
                      onPress={() => {
                        props.onChange({ ...props.draft!, fromUserId: member.userId });
                        setFromPickerOpen(false);
                      }}
                      style={[styles.fromOption, selected && styles.fromOptionSelected]}
                    >
                      <Text
                        style={[styles.fromOptionTitle, selected && styles.fromOptionTitleSelected]}
                      >
                        {organizerLabel(member, props.currentUserId, true)}
                      </Text>
                      {member.email && member.userId !== props.currentUserId ? (
                        <Text style={styles.fromOptionEmail}>{member.email}</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              : null}
          </View>

          <TextField
            autoCapitalize="none"
            autoCorrect={false}
            error={toEmailInvalid}
            focused={toFocused}
            keyboardType="email-address"
            label="Para"
            onBlur={() => setToFocused(false)}
            onChangeText={(toEmail) => props.onChange({ ...props.draft!, toEmail })}
            onFocus={() => setToFocused(true)}
            placeholder="nombre@correo.com"
            value={props.draft.toEmail}
          />

          <TextField
            focused={titleFocused}
            label="Asunto"
            onBlur={() => setTitleFocused(false)}
            onChangeText={(title) => props.onChange({ ...props.draft!, title })}
            onFocus={() => setTitleFocused(true)}
            placeholder="Ej. Consulta con María"
            value={props.draft.title}
          />

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.timeLabel}>Inicio</Text>
              <View style={styles.timeStepper}>
                <Pressable
                  hitSlop={8}
                  onPress={() => props.onChange(shiftStart(props.draft!, -SLOT_MINUTES))}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Text style={styles.timeValue}>{formatTime(props.draft.startsAt)}</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => props.onChange(shiftStart(props.draft!, SLOT_MINUTES))}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.timeField}>
              <Text style={styles.timeLabel}>Fin</Text>
              <View style={styles.timeStepper}>
                <Pressable
                  hitSlop={8}
                  onPress={() => props.onChange(shiftEnd(props.draft!, -SLOT_MINUTES))}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Text style={styles.timeValue}>{formatTime(props.draft.endsAt)}</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => props.onChange(shiftEnd(props.draft!, SLOT_MINUTES))}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <TextField
            focused={notesFocused}
            label="Notas"
            multiline
            onBlur={() => setNotesFocused(false)}
            onChangeText={(notes) => props.onChange({ ...props.draft!, notes })}
            onFocus={() => setNotesFocused(true)}
            placeholder="Opcional"
            value={props.draft.notes}
          />

          <View style={styles.composeActions}>
            <GhostButton label="Cancelar" onPress={props.onClose} />
            <PrimaryButton
              disabled={
                props.isSaving ||
                props.draft.title.trim().length === 0 ||
                toEmailInvalid
              }
              label={props.isSaving ? 'Guardando…' : 'Guardar'}
              onPress={props.onSave}
            />
          </View>
        </ScrollView>
      ) : null}
    </MobileContainedModal>
  );
}

function monthCells(visibleMonth: Date): Date[] {
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    return new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
  });
}

function shiftStart(draft: ComposeDraft, deltaMinutes: number): ComposeDraft {
  const durationMs = draft.endsAt.getTime() - draft.startsAt.getTime();
  const startsAt = addMinutes(draft.startsAt, deltaMinutes);
  return {
    ...draft,
    endsAt: new Date(startsAt.getTime() + durationMs),
    startsAt,
  };
}

function withCurrentOrganizer(
  organizers: AppointmentOrganizer[],
  currentUserId: string | null,
): AppointmentOrganizer[] {
  if (!currentUserId) {
    return organizers;
  }

  const self = organizers.find((member) => member.userId === currentUserId);
  const others = organizers.filter((member) => member.userId !== currentUserId);
  if (self) {
    return [self, ...others];
  }
  return [{ displayName: 'Yo', email: null, userId: currentUserId }, ...organizers];
}

function organizerLabel(
  organizer: AppointmentOrganizer | null,
  currentUserId: string | null,
  forPicker: boolean,
): string {
  if (!organizer) {
    return forPicker ? 'Elegí un miembro' : 'Sin asignar';
  }
  if (currentUserId && organizer.userId === currentUserId) {
    return forPicker ? 'Yo' : organizer.displayName || 'Yo';
  }
  return organizer.displayName;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(left: Date, right: Date): boolean {
  return dayKey(left) === dayKey(right);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function atHour(day: Date, hour: number, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function nextHalfHour(selectedDate: Date, now: Date): Date {
  if (!isSameDay(selectedDate, now)) {
    return atHour(selectedDate, 9, 0);
  }

  const minutes = now.getMinutes() < 30 ? 30 : 60;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(minutes === 60 ? 0 : 30);
  if (minutes === 60) {
    next.setHours(now.getHours() + 1);
  }
  if (next.getHours() < DAY_START_HOUR) {
    return atHour(selectedDate, DAY_START_HOUR, 0);
  }
  if (next.getHours() >= DAY_END_HOUR) {
    return atHour(selectedDate, DAY_END_HOUR - 1, 0);
  }
  return next;
}


const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  calendarCard: {
    padding: 12,
  },
  composeActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  composeDate: {
    color: colors.slate,
    fontSize: 14,
    marginBottom: 16,
  },
  composeSheet: {
    maxHeight: '88%',
  },
  composeTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  fromButton: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  fromOption: {
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fromOptionEmail: {
    color: colors.slate,
    fontSize: 12,
    marginTop: 2,
  },
  fromOptionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  fromOptionTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '500',
  },
  fromOptionTitleSelected: {
    fontWeight: '700',
  },
  fromValue: {
    color: colors.navy,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  partyField: {
    gap: 8,
    marginBottom: 12,
  },
  dayCard: {
    overflow: 'hidden',
  },
  dayCell: {
    alignItems: 'center',
    height: 44,
    paddingTop: 2,
    width: '14.285714%',
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dayMuted: {
    color: colors.slateLight,
  },
  dayNumber: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '500',
  },
  dayNumberSelected: {
    color: colors.surface,
    fontWeight: '700',
  },
  dayNumberToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  dayNumberWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  dayToday: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  eventBlock: {
    backgroundColor: colors.primarySoft,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    borderRadius: 6,
    left: TIME_GUTTER + 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    right: 8,
    zIndex: 2,
  },
  eventBlockCancelled: {
    backgroundColor: colors.badgeNeutralBg,
    borderLeftColor: colors.slateLight,
    opacity: 0.7,
  },
  eventBlockCompleted: {
    backgroundColor: colors.infoSoft,
    borderLeftColor: colors.info,
  },
  eventDot: {
    backgroundColor: 'transparent',
    borderRadius: 999,
    height: 4,
    marginTop: 2,
    width: 4,
  },
  eventDotSelected: {
    backgroundColor: colors.surface,
  },
  eventDotVisible: {
    backgroundColor: colors.primary,
  },
  eventTime: {
    color: colors.slate,
    fontSize: 12,
  },
  eventTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  monthLabel: {
    color: colors.navy,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  monthNav: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  nowDot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 8,
    marginLeft: TIME_GUTTER - 4,
    width: 8,
  },
  nowLine: {
    backgroundColor: colors.primary,
    flex: 1,
    height: 2,
  },
  nowMarker: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
  slot: {
    flexDirection: 'row',
    height: SLOT_HEIGHT,
  },
  slotHour: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  slotLine: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginTop: 0,
  },
  slotTime: {
    color: colors.slateLight,
    fontSize: 11,
    fontWeight: '500',
    paddingRight: 8,
    paddingTop: 2,
    textAlign: 'right',
    width: TIME_GUTTER,
  },
  slotTimeHalf: {
    color: 'transparent',
  },
  stepperText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeStepper: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  timeValue: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  timeline: {
    position: 'relative',
  },
  todayButton: {
    borderColor: colors.primary,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  todayButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  weekday: {
    color: colors.slateLight,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
});
