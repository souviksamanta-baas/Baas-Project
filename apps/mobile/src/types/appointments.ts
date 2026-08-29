export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Appointment {
  assignedToUserId: string | null;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  businessCenterId: string;
  contactId: string | null;
  contactLabel: string | null;
  createdAt: string;
  createdByUserId: string | null;
  endsAt: string;
  fromLabel: string | null;
  id: string;
  metadata: Record<string, unknown>;
  notes: string | null;
  organizationId: string;
  startsAt: string;
  status: AppointmentStatus;
  title: string;
  updatedAt: string;
}

export interface AppointmentOrganizer {
  displayName: string;
  email: string | null;
  userId: string;
}

export interface AppointmentInput {
  assignedToUserId?: string | null;
  attendeeEmail?: string | null;
  attendeePhone?: string | null;
  contactId?: string | null;
  endsAt: string;
  fromLabel?: string | null;
  notes?: string | null;
  startsAt: string;
  title: string;
}

export interface AppointmentUpdate {
  endsAt?: string;
  notes?: string | null;
  startsAt?: string;
  status?: AppointmentStatus;
  title?: string;
}
