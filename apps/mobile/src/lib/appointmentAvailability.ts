import type { Appointment } from '../types/appointments';

export type AssigneeAvailability = 'available' | 'busy';

/** True when [startsAt, endsAt) overlaps [otherStartsAt, otherEndsAt). */
export function intervalsOverlap(
  startsAt: string | Date,
  endsAt: string | Date,
  otherStartsAt: string | Date,
  otherEndsAt: string | Date,
): boolean {
  const startMs = toMs(startsAt);
  const endMs = toMs(endsAt);
  const otherStartMs = toMs(otherStartsAt);
  const otherEndMs = toMs(otherEndsAt);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    !Number.isFinite(otherStartMs) ||
    !Number.isFinite(otherEndMs)
  ) {
    return false;
  }
  return startMs < otherEndMs && endMs > otherStartMs;
}

/**
 * A member is busy when they already have a scheduled appointment overlapping the slot.
 * Completed / cancelled appointments do not block availability.
 */
export function isAssigneeBusyAt(params: {
  appointments: readonly Appointment[];
  endsAt: string | Date;
  excludeAppointmentId?: string | null;
  startsAt: string | Date;
  userId: string;
}): boolean {
  const { appointments, endsAt, excludeAppointmentId, startsAt, userId } = params;
  if (!userId) {
    return false;
  }

  return appointments.some((appointment) => {
    if (appointment.status !== 'scheduled') {
      return false;
    }
    if (appointment.assignedToUserId !== userId) {
      return false;
    }
    if (excludeAppointmentId && appointment.id === excludeAppointmentId) {
      return false;
    }
    return intervalsOverlap(startsAt, endsAt, appointment.startsAt, appointment.endsAt);
  });
}

export function assigneeAvailabilityAt(params: {
  appointments: readonly Appointment[];
  endsAt: string | Date;
  excludeAppointmentId?: string | null;
  startsAt: string | Date;
  userId: string;
}): AssigneeAvailability {
  return isAssigneeBusyAt(params) ? 'busy' : 'available';
}

export function availabilityLabel(availability: AssigneeAvailability): string {
  return availability === 'busy' ? 'Ocupado' : 'Disponible';
}

function toMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
