import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  assignAppointment,
  createAppointment,
  getAppointments,
  updateAppointment,
} from '../api/appointments';
import { supabase } from '../lib/supabase';
import type {
  Appointment,
  AppointmentInput,
  AppointmentUpdate,
} from '../types/appointments';

export interface AppointmentsState {
  appointments: Appointment[];
  assignAppointmentTo: (appointmentId: string, assignedToUserId: string) => Promise<void>;
  createAppointment: (input: AppointmentInput) => Promise<Appointment | null>;
  errorMessage: string | null;
  isLoading: boolean;
  isSaving: boolean;
  refresh: () => Promise<void>;
  updateAppointment: (
    appointmentId: string,
    updates: AppointmentUpdate,
  ) => Promise<Appointment | null>;
}

export function useAppointments(
  organizationId: string | null,
  businessCenterId: string | null,
): AppointmentsState {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      setAppointments([]);
      return;
    }

    const next = await getAppointments(organizationId, businessCenterId, {
      statuses: ['scheduled', 'completed'],
    });
    setAppointments(next);
  }, [businessCenterId, organizationId]);

  useEffect(() => {
    if (!organizationId || !businessCenterId) {
      setAppointments([]);
      return undefined;
    }

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    load()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
        Alert.alert('No se pudo cargar la agenda', message);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    const channel = supabase
      .channel(`appointments:${organizationId}:${businessCenterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `business_center_id=eq.${businessCenterId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [businessCenterId, load, organizationId]);

  const createHandler = useCallback(
    async (input: AppointmentInput): Promise<Appointment | null> => {
      if (!organizationId || !businessCenterId) {
        return null;
      }

      setIsSaving(true);
      setErrorMessage(null);
      try {
        const appointment = await createAppointment(organizationId, businessCenterId, input);
        await load();
        return appointment;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
        Alert.alert('No se pudo crear el turno', message);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [businessCenterId, load, organizationId],
  );

  const updateHandler = useCallback(
    async (
      appointmentId: string,
      updates: AppointmentUpdate,
    ): Promise<Appointment | null> => {
      if (!organizationId || !businessCenterId) {
        return null;
      }

      setIsSaving(true);
      setErrorMessage(null);
      try {
        const appointment = await updateAppointment(
          organizationId,
          businessCenterId,
          appointmentId,
          updates,
        );
        await load();
        return appointment;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
        Alert.alert('No se pudo actualizar el turno', message);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [businessCenterId, load, organizationId],
  );

  const assignHandler = useCallback(
    async (appointmentId: string, assignedToUserId: string): Promise<void> => {
      if (!organizationId || !businessCenterId) {
        return;
      }

      setIsSaving(true);
      setErrorMessage(null);
      try {
        await assignAppointment(
          organizationId,
          businessCenterId,
          appointmentId,
          assignedToUserId,
        );
        await load();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(message);
        Alert.alert('No se pudo asignar el turno', message);
      } finally {
        setIsSaving(false);
      }
    },
    [businessCenterId, load, organizationId],
  );

  return {
    appointments,
    assignAppointmentTo: assignHandler,
    createAppointment: createHandler,
    errorMessage,
    isLoading,
    isSaving,
    refresh: load,
    updateAppointment: updateHandler,
  };
}
