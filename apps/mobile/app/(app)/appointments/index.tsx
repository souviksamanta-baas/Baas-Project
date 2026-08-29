import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { listOrganizationMembers } from '../../../src/api/accountLifecycle';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useAppointments } from '../../../src/hooks/useAppointments';
import { supabase } from '../../../src/lib/supabase';
import { appointmentDetailRoute, routes } from '../../../src/navigation/routes';
import { AppointmentsScreen } from '../../../src/screens/AppointmentsScreen';
import type { AppointmentOrganizer } from '../../../src/types/appointments';

export default function AppointmentsRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const appointmentsState = useAppointments(organizationId, businessCenterId);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [organizers, setOrganizers] = useState<AppointmentOrganizer[]>([]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setCurrentUserId(data.user?.id ?? null);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setOrganizers([]);
      return;
    }

    let mounted = true;
    void listOrganizationMembers(organizationId)
      .then((members) => {
        if (!mounted) {
          return;
        }
        setOrganizers(
          members.map((member) => ({
            displayName: member.displayName,
            email: member.email,
            userId: member.userId,
          })),
        );
      })
      .catch(() => {
        if (mounted) {
          setOrganizers([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [organizationId]);

  return (
    <AppointmentsScreen
      appointments={appointmentsState.appointments}
      businessCenterId={businessCenterId}
      currentUserId={currentUserId}
      isLoading={appointmentsState.isLoading}
      isSaving={appointmentsState.isSaving}
      onCreateAppointment={appointmentsState.createAppointment}
      onOpenAppointment={(appointmentId) =>
        router.push(appointmentDetailRoute(appointmentId, 'agenda'))
      }
      onOpenCopi={() => router.push(routes.appCopiChat)}
      organizationId={organizationId}
      organizers={organizers}
    />
  );
}
