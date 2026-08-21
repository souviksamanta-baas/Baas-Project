import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import type { Appointment, AppointmentStatus } from '../types/appointments';
import { colors } from '../theme';

export function AppointmentDetailScreen(props: {
  appointment: Appointment;
  isSaving?: boolean;
  onBack: () => void;
  onCancelAppointment: () => Promise<void>;
  onCompleteAppointment: () => Promise<void>;
}): ReactElement {
  const startsAt = new Date(props.appointment.startsAt);
  const endsAt = new Date(props.appointment.endsAt);
  const dateLabel = startsAt.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  });
  const timeRange = `${startsAt.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })} – ${endsAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <ScreenContent>
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title={props.appointment.title} />
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.meta}>Fecha: {dateLabel}</Text>
        <Text style={styles.meta}>Horario: {timeRange}</Text>
        {props.appointment.fromLabel ? (
          <Text style={styles.meta}>De: {props.appointment.fromLabel}</Text>
        ) : null}
        {props.appointment.attendeeEmail ? (
          <Text style={styles.meta}>Para: {props.appointment.attendeeEmail}</Text>
        ) : null}
        {props.appointment.contactLabel ? (
          <Text style={styles.meta}>Contacto: {props.appointment.contactLabel}</Text>
        ) : null}
        <Text style={styles.meta}>Estado: {statusLabel(props.appointment.status)}</Text>
        {props.appointment.notes ? (
          <Text style={styles.body}>{props.appointment.notes}</Text>
        ) : null}
      </Card>

      {props.appointment.status === 'scheduled' ? (
        <View style={styles.actions}>
          <Pressable
            disabled={props.isSaving}
            onPress={() => void props.onCancelAppointment()}
          >
            <Text style={styles.actionText}>Cancelar turno</Text>
          </Pressable>
          <Pressable
            disabled={props.isSaving}
            onPress={() => void props.onCompleteAppointment()}
          >
            <Text style={styles.actionTextPrimary}>Marcar como completado</Text>
          </Pressable>
        </View>
      ) : null}
    </ScreenContent>
  );
}

function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Programado';
    case 'completed':
      return 'Completado';
    case 'cancelled':
      return 'Cancelado';
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
  meta: {
    color: colors.slate,
    fontSize: 15,
  },
});
