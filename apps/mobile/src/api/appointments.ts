import type { AssigneeAvailability } from '../lib/appointmentAvailability';
import { supabase } from '../lib/supabase';
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  AppointmentUpdate,
} from '../types/appointments';

interface ContactRow {
  display_name: string | null;
  phone_number: string | null;
}

interface AppointmentRow {
  assigned_to_user_id: string | null;
  business_center_id: string;
  contact_id: string | null;
  contacts: ContactRow | ContactRow[] | null;
  created_at: string;
  created_by_user_id: string | null;
  ends_at: string;
  id: string;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  organization_id: string;
  starts_at: string;
  status: AppointmentStatus;
  title: string;
  updated_at: string;
}

const APPOINTMENT_SELECT =
  'id, organization_id, business_center_id, title, starts_at, ends_at, status, notes, contact_id, assigned_to_user_id, created_by_user_id, metadata, created_at, updated_at, contacts(display_name, phone_number)';

export async function getAppointments(
  organizationId: string,
  businessCenterId: string,
  options?: {
    fromDate?: string;
    limit?: number;
    statuses?: AppointmentStatus[];
    toDate?: string;
  },
): Promise<Appointment[]> {
  let query = supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .order('starts_at', { ascending: true })
    .limit(options?.limit ?? 100);

  if (options?.statuses?.length) {
    query = query.in('status', options.statuses);
  }

  if (options?.fromDate) {
    query = query.gte('starts_at', options.fromDate);
  }

  if (options?.toDate) {
    query = query.lt('starts_at', options.toDate);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data as AppointmentRow[]).map(toAppointment);
}

export async function getAppointment(
  organizationId: string,
  businessCenterId: string,
  appointmentId: string,
): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toAppointment(data as AppointmentRow) : null;
}

export async function createAppointment(
  organizationId: string,
  businessCenterId: string,
  input: AppointmentInput,
): Promise<Appointment> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(userError.message);
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      assigned_to_user_id: input.assignedToUserId ?? null,
      business_center_id: businessCenterId,
      contact_id: input.contactId ?? null,
      created_by_user_id: user?.id ?? null,
      ends_at: input.endsAt,
      metadata: {
        attendeeEmail: input.attendeeEmail ?? null,
        attendeePhone: input.attendeePhone ?? null,
        fromLabel: input.fromLabel ?? null,
      },
      notes: input.notes ?? null,
      organization_id: organizationId,
      starts_at: input.startsAt,
      status: 'scheduled',
      title: input.title,
    })
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toAppointment(data as AppointmentRow);
}

export async function updateAppointment(
  organizationId: string,
  businessCenterId: string,
  appointmentId: string,
  updates: AppointmentUpdate,
): Promise<Appointment> {
  const patch: Record<string, string | null> = {};
  if (updates.title != null) patch.title = updates.title;
  if (updates.startsAt != null) patch.starts_at = updates.startsAt;
  if (updates.endsAt != null) patch.ends_at = updates.endsAt;
  if (updates.status != null) patch.status = updates.status;
  if (updates.notes !== undefined) patch.notes = updates.notes;

  if (Object.keys(patch).length === 0) {
    throw new Error('No hay cambios para guardar.');
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(patch)
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('id', appointmentId)
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toAppointment(data as AppointmentRow);
}

export async function assignAppointment(
  organizationId: string,
  businessCenterId: string,
  appointmentId: string,
  assignedToUserId: string,
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ assigned_to_user_id: assignedToUserId })
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('id', appointmentId)
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toAppointment(data as AppointmentRow);
}

/**
 * Returns whether each assignee is available or busy for the given slot,
 * based on overlapping scheduled appointments.
 */
export async function getAssigneesAvailability(
  organizationId: string,
  businessCenterId: string,
  params: {
    endsAt: string;
    excludeAppointmentId?: string | null;
    startsAt: string;
    userIds: string[];
  },
): Promise<Record<string, AssigneeAvailability>> {
  const availability: Record<string, AssigneeAvailability> = {};
  for (const userId of params.userIds) {
    availability[userId] = 'available';
  }

  const userIds = [...new Set(params.userIds.filter(Boolean))];
  if (userIds.length === 0) {
    return availability;
  }

  let query = supabase
    .from('appointments')
    .select('id, assigned_to_user_id')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('status', 'scheduled')
    .in('assigned_to_user_id', userIds)
    .lt('starts_at', params.endsAt)
    .gt('ends_at', params.startsAt);

  if (params.excludeAppointmentId) {
    query = query.neq('id', params.excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const userId = (row as { assigned_to_user_id: string | null }).assigned_to_user_id;
    if (userId) {
      availability[userId] = 'busy';
    }
  }

  return availability;
}

function toAppointment(row: AppointmentRow): Appointment {
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const attendeeEmail =
    typeof metadata.attendeeEmail === 'string' && metadata.attendeeEmail.trim()
      ? metadata.attendeeEmail.trim()
      : null;
  const attendeePhone =
    typeof metadata.attendeePhone === 'string' && metadata.attendeePhone.trim()
      ? metadata.attendeePhone.trim()
      : null;
  const fromLabel =
    typeof metadata.fromLabel === 'string' && metadata.fromLabel.trim()
      ? metadata.fromLabel.trim()
      : null;
  return {
    assignedToUserId: row.assigned_to_user_id,
    attendeeEmail,
    attendeePhone,
    businessCenterId: row.business_center_id,
    contactId: row.contact_id,
    contactLabel: contact?.display_name ?? contact?.phone_number ?? null,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    endsAt: row.ends_at,
    fromLabel,
    id: row.id,
    metadata,
    notes: row.notes,
    organizationId: row.organization_id,
    startsAt: row.starts_at,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}
