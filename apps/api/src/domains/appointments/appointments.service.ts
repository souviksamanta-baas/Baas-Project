import { Inject, Injectable, Optional, forwardRef } from '@nestjs/common';

import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../../supabase/supabase.service';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface AppointmentRecord {
  assignedToUserId: string | null;
  businessCenterId: string;
  contactId: string | null;
  createdAt: string;
  createdByUserId: string | null;
  endsAt: string;
  id: string;
  metadata: Record<string, unknown>;
  notes: string | null;
  organizationId: string;
  startsAt: string;
  status: AppointmentStatus;
  taskId: string | null;
  title: string;
  updatedAt: string;
}

interface AppointmentRow {
  assigned_to_user_id: string | null;
  business_center_id: string;
  contact_id: string | null;
  created_at: string;
  created_by_user_id: string | null;
  ends_at: string;
  id: string;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  organization_id: string;
  starts_at: string;
  status: AppointmentStatus;
  task_id: string | null;
  title: string;
  updated_at: string;
}

const APPOINTMENT_SELECT =
  'id, organization_id, business_center_id, title, starts_at, ends_at, status, notes, contact_id, assigned_to_user_id, created_by_user_id, metadata, task_id, created_at, updated_at';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  async listAppointments(params: {
    assignedToUserId?: string;
    businessCenterId: string;
    fromDate?: string;
    limit?: number;
    organizationId: string;
    statuses?: AppointmentStatus[];
    toDate?: string;
  }): Promise<AppointmentRecord[]> {
    const client = this.supabaseService.getServiceRoleClient();
    let query = client
      .from('appointments')
      .select(APPOINTMENT_SELECT)
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .order('starts_at', { ascending: true })
      .limit(params.limit ?? 50);

    if (params.statuses?.length) {
      query = query.in('status', params.statuses);
    }

    if (params.assignedToUserId) {
      query = query.eq('assigned_to_user_id', params.assignedToUserId);
    }

    if (params.fromDate) {
      query = query.gte('starts_at', params.fromDate);
    }

    if (params.toDate) {
      query = query.lt('starts_at', params.toDate);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list appointments: ${error.message}`);
    }

    return (data as AppointmentRow[]).map(toAppointmentRecord);
  }

  async createAppointment(params: {
    assignedToUserId?: string | null;
    businessCenterId: string;
    contactId?: string | null;
    createdByUserId: string;
    endsAt: string;
    metadata?: Record<string, unknown>;
    notes?: string | null;
    organizationId: string;
    startsAt: string;
    taskId?: string | null;
    title: string;
  }): Promise<AppointmentRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('appointments')
      .insert({
        assigned_to_user_id: params.assignedToUserId ?? null,
        business_center_id: params.businessCenterId,
        contact_id: params.contactId ?? null,
        created_by_user_id: params.createdByUserId,
        ends_at: params.endsAt,
        metadata: params.metadata ?? {},
        notes: params.notes ?? null,
        organization_id: params.organizationId,
        starts_at: params.startsAt,
        status: 'scheduled',
        task_id: params.taskId ?? null,
        title: params.title,
      })
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to create appointment: ${error.message}`);
    }

    const appointment = toAppointmentRecord(data as AppointmentRow);
    if (appointment.assignedToUserId && this.notificationsService) {
      await this.notificationsService.notifyAppointmentAssigned({
        appointmentId: appointment.id,
        assignedToUserId: appointment.assignedToUserId,
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
        title: appointment.title,
      });
    }

    return appointment;
  }

  async createFromTask(params: {
    assignedToUserId?: string | null;
    businessCenterId: string;
    contactId?: string | null;
    createdByUserId: string;
    endsAt: string;
    notes?: string | null;
    organizationId: string;
    startsAt: string;
    task: { id: string; title: string };
    title?: string;
  }): Promise<AppointmentRecord> {
    return this.createAppointment({
      assignedToUserId: params.assignedToUserId ?? null,
      businessCenterId: params.businessCenterId,
      contactId: params.contactId ?? null,
      createdByUserId: params.createdByUserId,
      endsAt: params.endsAt,
      metadata: { fromTaskId: params.task.id },
      notes: params.notes ?? null,
      organizationId: params.organizationId,
      startsAt: params.startsAt,
      taskId: params.task.id,
      title: params.title?.trim() || params.task.title,
    });
  }

  async updateAppointment(params: {
    appointmentId: string;
    businessCenterId: string;
    endsAt?: string;
    notes?: string | null;
    organizationId: string;
    startsAt?: string;
    status?: AppointmentStatus;
    title?: string;
  }): Promise<AppointmentRecord> {
    const updates: Record<string, string | null> = {};
    if (params.title != null) updates.title = params.title;
    if (params.startsAt != null) updates.starts_at = params.startsAt;
    if (params.endsAt != null) updates.ends_at = params.endsAt;
    if (params.status != null) updates.status = params.status;
    if (params.notes !== undefined) updates.notes = params.notes;

    if (Object.keys(updates).length === 0) {
      throw new Error('No updates provided for appointment.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('appointments')
      .update(updates)
      .eq('id', params.appointmentId)
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to update appointment: ${error.message}`);
    }

    return toAppointmentRecord(data as AppointmentRow);
  }

  async assignAppointment(params: {
    appointmentId: string;
    assignedToUserId: string;
    businessCenterId: string;
    organizationId: string;
  }): Promise<AppointmentRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('appointments')
      .update({ assigned_to_user_id: params.assignedToUserId })
      .eq('id', params.appointmentId)
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to assign appointment: ${error.message}`);
    }

    const appointment = toAppointmentRecord(data as AppointmentRow);
    if (this.notificationsService) {
      await this.notificationsService.notifyAppointmentAssigned({
        appointmentId: appointment.id,
        assignedToUserId: params.assignedToUserId,
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
        title: appointment.title,
      });
    }

    return appointment;
  }
}

function toAppointmentRecord(row: AppointmentRow): AppointmentRecord {
  return {
    assignedToUserId: row.assigned_to_user_id,
    businessCenterId: row.business_center_id,
    contactId: row.contact_id,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    endsAt: row.ends_at,
    id: row.id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    notes: row.notes,
    organizationId: row.organization_id,
    startsAt: row.starts_at,
    status: row.status,
    taskId: row.task_id ?? null,
    title: row.title,
    updatedAt: row.updated_at,
  };
}
