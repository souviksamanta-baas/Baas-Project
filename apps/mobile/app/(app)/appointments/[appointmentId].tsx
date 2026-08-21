import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getAppointment } from '../../../src/api/appointments';
import { ScreenContent } from '../../../src/components/ui';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useAppointments } from '../../../src/hooks/useAppointments';
import {
  parseAppointmentReturnTo,
  resolveAppointmentReturnRoute,
} from '../../../src/navigation/routes';
import { AppointmentDetailScreen } from '../../../src/screens/AppointmentDetailScreen';
import type { Appointment } from '../../../src/types/appointments';
import { colors } from '../../../src/theme';

export default function AppointmentDetailRoute(): ReactElement {
  const router = useRouter();
  const { appointmentId: rawAppointmentId, returnTo: rawReturnTo } = useLocalSearchParams<{
    appointmentId: string;
    returnTo?: string | string[];
  }>();
  const returnTo = parseAppointmentReturnTo(rawReturnTo);
  const appointmentId = Array.isArray(rawAppointmentId) ? rawAppointmentId[0] : rawAppointmentId;
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const appointmentsState = useAppointments(organizationId, businessCenterId);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!organizationId || !businessCenterId || !appointmentId) {
      setAppointment(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    getAppointment(organizationId, businessCenterId, appointmentId)
      .then((next) => {
        if (mounted) {
          setAppointment(next);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [appointmentId, businessCenterId, organizationId]);

  if (isLoading) {
    return (
      <ScreenContent>
        <ActivityIndicator color={colors.primary} />
      </ScreenContent>
    );
  }

  if (!appointment) {
    return (
      <ScreenContent>
        <Text>No se encontró el turno.</Text>
      </ScreenContent>
    );
  }

  return (
    <AppointmentDetailScreen
      appointment={appointment}
      isSaving={appointmentsState.isSaving}
      onBack={() => router.replace(resolveAppointmentReturnRoute(returnTo))}
      onCancelAppointment={async () => {
        const next = await appointmentsState.updateAppointment(appointment.id, {
          status: 'cancelled',
        });
        if (next) {
          setAppointment(next);
        }
      }}
      onCompleteAppointment={async () => {
        const next = await appointmentsState.updateAppointment(appointment.id, {
          status: 'completed',
        });
        if (next) {
          setAppointment(next);
        }
      }}
    />
  );
}
