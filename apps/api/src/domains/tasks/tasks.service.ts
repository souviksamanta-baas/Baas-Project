import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';

import { InventoryService, type InventoryProduct } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface TaskMaintenanceResult {
  followUpTasksCreated: number;
  lowStockAlertsCreated: number;
  notificationsCreated: number;
  pushNotificationsSent: number;
  pushNotificationsFailed: number;
}

export type OwnerTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'postponed';

export type OwnerTaskType = 'follow_up' | 'manual' | 'copi' | 'inventory' | 'callback';

export interface OwnerTaskRecord {
  assignedToUserId: string | null;
  businessCenterId: string;
  contactId: string | null;
  /** Present when list query joins contacts — avoids a client round-trip. */
  contactLabel?: string | null;
  conversationId: string | null;
  createdByUserId: string | null;
  description: string | null;
  dueAt: string | null;
  id: string;
  organizationId: string;
  postponedUntil: string | null;
  priority: 'low' | 'normal' | 'high';
  reminderSnoozedUntil: string | null;
  status: OwnerTaskStatus;
  taskType: OwnerTaskType;
  title: string;
}

interface BusinessCenterRow {
  ai_follow_up_delay_hours: number;
  id: string;
  organization_id: string;
}

interface ContactRow {
  display_name: string | null;
  id: string | null;
  lead_status: 'new' | 'active' | 'cold' | 'won' | 'lost' | null;
  phone_number: string | null;
}

interface ConversationRow {
  business_center_id: string;
  contact_id: string | null;
  contacts: ContactRow | ContactRow[] | null;
  customer_display_name: string | null;
  external_contact_id: string;
  id: string;
  last_message_at: string | null;
  organization_id: string;
}

interface InsertedNotificationRow {
  id: string;
  source_key: string;
}

interface InsertedOwnerTaskRow {
  contact_id: string | null;
  id: string;
}

interface LowStockNotificationInsertRow {
  body: string;
  business_center_id: string;
  channel: 'stock';
  notification_type: 'stock.low';
  organization_id: string;
  payload: {
    productId: string;
    reorderThreshold: number;
    stockQuantity: number;
  };
  product_id: string;
  source_key: string;
  title: string;
}

interface OwnerDeviceTokenRow {
  push_token: string;
}

interface OwnerTaskInsertRow {
  business_center_id: string;
  contact_id: string | null;
  conversation_id: string;
  description: string;
  due_at: string;
  metadata: {
    automation: 'cold_lead_follow_up';
  };
  organization_id: string;
  priority: 'high';
  source_key: string;
  task_type: 'follow_up';
  title: string;
}

interface ExpoPushResponse {
  data?: Array<{
    id?: string;
    message?: string;
    status?: 'ok' | 'error';
  }>;
  errors?: Array<{
    message?: string;
  }>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TASK_MAINTENANCE_CONCURRENCY = 5;
const DEFAULT_REMINDER_SNOOZE_MINUTES = 10;
const TASK_SELECT =
  'id, organization_id, business_center_id, title, description, status, due_at, postponed_until, reminder_snoozed_until, task_type, priority, contact_id, conversation_id, assigned_to_user_id, created_by_user_id';

@Injectable()
export class TasksService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly inventoryService: InventoryService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  async runMaintenance(params: {
    now?: Date;
    organizationId?: string;
  } = {}): Promise<TaskMaintenanceResult> {
    const now = params.now ?? new Date();
    const businessCenters = await this.listBusinessCenters(params.organizationId);
    const results = await mapWithConcurrency(
      businessCenters,
      TASK_MAINTENANCE_CONCURRENCY,
      async (businessCenter) => this.runBusinessCenterMaintenance(businessCenter, now),
    );

    const scheduled = this.notificationsService
      ? await this.notificationsService.runScheduled({
          now,
          organizationId: params.organizationId,
        })
      : { notificationsCreated: 0, pushFailed: 0, pushSent: 0 };

    const aggregated = results.reduce(sumTaskMaintenanceResults, emptyTaskMaintenanceResult());
    return {
      ...aggregated,
      notificationsCreated: aggregated.notificationsCreated + scheduled.notificationsCreated,
      pushNotificationsFailed: aggregated.pushNotificationsFailed + scheduled.pushFailed,
      pushNotificationsSent: aggregated.pushNotificationsSent + scheduled.pushSent,
    };
  }

  async listTasks(params: {
    assignedToUserId?: string;
    /** @deprecated Ignored for list — org-wide visibility (KAN-401). Kept for API compat. */
    businessCenterId?: string;
    contactHint?: string;
    dueBefore?: string;
    dueFrom?: string;
    limit?: number;
    organizationId: string;
    statuses?: OwnerTaskStatus[];
  }): Promise<OwnerTaskRecord[]> {
    const client = this.supabaseService.getServiceRoleClient();
    let query = client
      .from('owner_tasks')
      .select(
        `${TASK_SELECT}, contacts(display_name, phone_number)`,
      )
      .eq('organization_id', params.organizationId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(params.limit ?? 50);

    if (params.statuses?.length) {
      query = query.in('status', params.statuses);
    }

    if (params.assignedToUserId) {
      query = query.eq('assigned_to_user_id', params.assignedToUserId);
    }

    if (params.dueFrom) {
      query = query.gte('due_at', params.dueFrom);
    }

    if (params.dueBefore) {
      query = query.lte('due_at', params.dueBefore);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list owner tasks: ${error.message}`);
    }

    let rows = (data ?? []) as Array<Record<string, unknown>>;
    if (params.contactHint?.trim()) {
      const hint = params.contactHint.toLocaleLowerCase();
      rows = rows.filter((row) => {
        const contacts = row.contacts as
          | { display_name: string | null; phone_number: string | null }
          | Array<{ display_name: string | null; phone_number: string | null }>
          | null;
        const contact = Array.isArray(contacts) ? contacts[0] : contacts;
        const haystack = `${contact?.display_name ?? ''} ${contact?.phone_number ?? ''} ${row.title ?? ''}`
          .toLocaleLowerCase();
        return haystack.includes(hint);
      });
    }

    return rows.map(toOwnerTaskRecord);
  }

  async getTask(params: {
    /** @deprecated Ignored — org-wide lookup by organization + task id. */
    businessCenterId?: string;
    organizationId: string;
    taskId: string;
  }): Promise<OwnerTaskRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .select(TASK_SELECT)
      .eq('id', params.taskId)
      .eq('organization_id', params.organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load owner task: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('La tarea no existe o no pertenece a esta organización.');
    }

    return toOwnerTaskRecord(data as Record<string, unknown>);
  }

  async createTask(params: {
    assignedToUserId?: string | null;
    businessCenterId: string;
    contactId?: string | null;
    conversationId?: string | null;
    createdByUserId: string;
    description?: string | null;
    dueAt?: string | null;
    metadata?: Record<string, unknown>;
    organizationId: string;
    priority?: 'low' | 'normal' | 'high';
    sourceKey: string;
    taskType?: OwnerTaskType;
    title: string;
  }): Promise<OwnerTaskRecord> {
    this.assertCreateMandatoryFields({
      assignedToUserId: params.assignedToUserId ?? null,
      description: params.description ?? null,
      dueAt: params.dueAt ?? null,
      title: params.title,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .insert({
        assigned_to_user_id: params.assignedToUserId ?? null,
        business_center_id: params.businessCenterId,
        contact_id: params.contactId ?? null,
        conversation_id: params.conversationId ?? null,
        created_by_user_id: params.createdByUserId,
        description: params.description ?? null,
        due_at: params.dueAt ?? null,
        metadata: params.metadata ?? {},
        organization_id: params.organizationId,
        priority: params.priority ?? 'normal',
        source_key: params.sourceKey,
        status: 'pending',
        task_type: params.taskType ?? 'manual',
        title: params.title,
      })
      .select(TASK_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to create owner task: ${error.message}`);
    }

    const task = toOwnerTaskRecord(data as Record<string, unknown>);
    if (task.assignedToUserId && this.notificationsService) {
      await this.notificationsService.notifyTaskAssigned({
        assignedToUserId: task.assignedToUserId,
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
        taskId: task.id,
        title: task.title,
      });
    }

    return task;
  }

  async updateTask(params: {
    businessCenterId: string;
    contactId?: string | null;
    description?: string | null;
    dueAt?: string | null;
    organizationId: string;
    priority?: 'low' | 'normal' | 'high';
    taskId: string;
    title?: string;
  }): Promise<OwnerTaskRecord> {
    const updates: Record<string, unknown> = {};
    if (params.title !== undefined) {
      if (typeof params.title !== 'string' || params.title.trim().length === 0) {
        throw new BadRequestException('El título de la tarea no puede estar vacío.');
      }
      updates.title = params.title.trim();
    }
    if (params.description !== undefined) {
      updates.description = params.description === null ? null : String(params.description).trim();
    }
    if (params.dueAt !== undefined) {
      updates.due_at = params.dueAt;
    }
    if (params.priority !== undefined) {
      updates.priority = params.priority;
    }
    if (params.contactId !== undefined) {
      updates.contact_id = params.contactId;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No se proporcionaron cambios para la tarea.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .update(updates)
      .eq('id', params.taskId)
      .eq('organization_id', params.organizationId)
      .select(TASK_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to update owner task: ${error.message}`);
    }

    return toOwnerTaskRecord(data as Record<string, unknown>);
  }

  async updateTaskStatus(params: {
    actorUserId?: string | null;
    businessCenterId: string;
    completedByUserId?: string;
    organizationId: string;
    postponedUntil?: string;
    /** @deprecated Use postponedUntil. Retained for legacy callers. */
    snoozedUntil?: string;
    status: OwnerTaskStatus;
    taskId: string;
  }): Promise<OwnerTaskRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const updates: Record<string, string | null> = {
      status: params.status,
    };

    if (params.status === 'completed') {
      updates.completed_at = new Date().toISOString();
      if (params.completedByUserId) {
        updates.completed_by_user_id = params.completedByUserId;
      }
    }

    const postponedUntil = params.postponedUntil ?? params.snoozedUntil;
    if (params.status === 'postponed' && postponedUntil) {
      updates.postponed_until = postponedUntil;
      updates.due_at = postponedUntil;
    }

    // Starting a task clears any prior reminder snooze so recordatorios resume.
    if (params.status === 'in_progress') {
      updates.reminder_snoozed_until = null;
    }

    const { data, error } = await client
      .from('owner_tasks')
      .update(updates)
      .eq('id', params.taskId)
      .eq('organization_id', params.organizationId)
      .select(TASK_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to update owner task: ${error.message}`);
    }

    const task = toOwnerTaskRecord(data as Record<string, unknown>);
    try {
      await this.emitStatusChangedIfNeeded({
        actorUserId: params.actorUserId ?? params.completedByUserId ?? null,
        organizationId: params.organizationId,
        task,
      });
    } catch (error) {
      // Status already persisted — never fail the mutation because push/prefs failed.
      console.error('Failed to emit task.status_changed notification', {
        error: error instanceof Error ? error.message : error,
        taskId: params.taskId,
      });
    }

    return task;
  }

  async postponeTask(params: {
    actorUserId?: string | null;
    businessCenterId: string;
    organizationId: string;
    postponedUntil: string;
    taskId: string;
  }): Promise<OwnerTaskRecord> {
    const iso = this.assertIsoDate(params.postponedUntil, 'posponer');
    return this.updateTaskStatus({
      actorUserId: params.actorUserId,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      postponedUntil: iso,
      status: 'postponed',
      taskId: params.taskId,
    });
  }

  async startTask(params: {
    actorUserId?: string | null;
    businessCenterId: string;
    organizationId: string;
    taskId: string;
  }): Promise<OwnerTaskRecord> {
    return this.updateTaskStatus({
      actorUserId: params.actorUserId,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      status: 'in_progress',
      taskId: params.taskId,
    });
  }

  async snoozeReminder(params: {
    businessCenterId: string;
    minutes?: number;
    organizationId: string;
    taskId: string;
  }): Promise<OwnerTaskRecord> {
    const minutes = Math.max(1, Math.floor(params.minutes ?? DEFAULT_REMINDER_SNOOZE_MINUTES));
    const reminderSnoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString();

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .update({ reminder_snoozed_until: reminderSnoozedUntil })
      .eq('id', params.taskId)
      .eq('organization_id', params.organizationId)
      .select(TASK_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to snooze reminder: ${error.message}`);
    }

    return toOwnerTaskRecord(data as Record<string, unknown>);
  }

  async assignTask(params: {
    assignedToUserId: string;
    businessCenterId: string;
    organizationId: string;
    taskId: string;
  }): Promise<OwnerTaskRecord> {
    if (!params.assignedToUserId?.trim()) {
      throw new BadRequestException('assignedToUserId es obligatorio.');
    }
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .update({ assigned_to_user_id: params.assignedToUserId })
      .eq('id', params.taskId)
      .eq('organization_id', params.organizationId)
      .select(TASK_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to assign owner task: ${error.message}`);
    }

    const task = toOwnerTaskRecord(data as Record<string, unknown>);
    if (task.assignedToUserId && this.notificationsService) {
      await this.notificationsService.notifyTaskAssigned({
        assignedToUserId: task.assignedToUserId,
        businessCenterId: task.businessCenterId,
        organizationId: params.organizationId,
        taskId: task.id,
        title: task.title,
      });
    }

    return task;
  }

  async addFollower(params: {
    organizationId: string;
    taskId: string;
    userId: string;
  }): Promise<{ added: boolean }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('owner_task_followers')
      .upsert(
        {
          organization_id: params.organizationId,
          task_id: params.taskId,
          user_id: params.userId,
        },
        { ignoreDuplicates: true, onConflict: 'task_id,user_id' },
      );

    if (error) {
      throw new Error(`Failed to follow task: ${error.message}`);
    }

    return { added: true };
  }

  async removeFollower(params: {
    organizationId: string;
    taskId: string;
    userId: string;
  }): Promise<{ removed: boolean }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('owner_task_followers')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('task_id', params.taskId)
      .eq('user_id', params.userId);

    if (error) {
      throw new Error(`Failed to unfollow task: ${error.message}`);
    }

    return { removed: true };
  }

  async listFollowerUserIds(params: {
    organizationId: string;
    taskId: string;
  }): Promise<string[]> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_task_followers')
      .select('user_id')
      .eq('organization_id', params.organizationId)
      .eq('task_id', params.taskId);

    if (error) {
      throw new Error(`Failed to list task followers: ${error.message}`);
    }

    return ((data ?? []) as Array<{ user_id: string }>)
      .map((row) => row.user_id)
      .filter((userId): userId is string => Boolean(userId));
  }

  private assertCreateMandatoryFields(params: {
    assignedToUserId: string | null;
    description: string | null;
    dueAt: string | null;
    title: string;
  }): void {
    const missing: string[] = [];
    if (!params.title || typeof params.title !== 'string' || params.title.trim().length === 0) {
      missing.push('title');
    }
    if (
      !params.description ||
      typeof params.description !== 'string' ||
      params.description.trim().length === 0
    ) {
      missing.push('description');
    }
    if (!params.dueAt || typeof params.dueAt !== 'string' || params.dueAt.trim().length === 0) {
      missing.push('dueAt');
    } else if (Number.isNaN(Date.parse(params.dueAt))) {
      throw new BadRequestException('dueAt debe ser una fecha ISO válida.');
    }
    if (!params.assignedToUserId || typeof params.assignedToUserId !== 'string') {
      missing.push('assignedToUserId');
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Faltan campos obligatorios para crear la tarea: ${missing.join(', ')}`,
      );
    }
  }

  private assertIsoDate(value: string, verb: string): string {
    if (!value || typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      throw new BadRequestException(`Fecha inválida para ${verb}.`);
    }
    return new Date(value).toISOString();
  }

  private async emitStatusChangedIfNeeded(params: {
    actorUserId: string | null;
    organizationId: string;
    task: OwnerTaskRecord;
  }): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    const creatorUserId = params.task.createdByUserId;
    const followerUserIds = await this.listFollowerUserIds({
      organizationId: params.organizationId,
      taskId: params.task.id,
    });

    await this.notificationsService.notifyTaskStatusChanged({
      actorUserId: params.actorUserId,
      businessCenterId: params.task.businessCenterId,
      creatorUserId,
      followerUserIds,
      newStatus: params.task.status,
      organizationId: params.organizationId,
      postponedUntil: params.task.postponedUntil,
      taskId: params.task.id,
      title: params.task.title,
    });
  }

  private async runBusinessCenterMaintenance(
    businessCenter: BusinessCenterRow,
    now: Date,
  ): Promise<TaskMaintenanceResult> {
    const followUpTasksCreated = await this.createFollowUpTasksForBusinessCenter(
      businessCenter,
      now,
    );
    const lowStockResult = await this.createLowStockAlertsForBusinessCenter(businessCenter);

    return {
      followUpTasksCreated,
      lowStockAlertsCreated: lowStockResult.alertsCreated,
      notificationsCreated: 0,
      pushNotificationsFailed: lowStockResult.pushNotificationsFailed,
      pushNotificationsSent: lowStockResult.pushNotificationsSent,
    };
  }

  private async listBusinessCenters(organizationId?: string): Promise<BusinessCenterRow[]> {
    const client = this.supabaseService.getServiceRoleClient();
    let query = client
      .from('business_centers')
      .select('id, organization_id, ai_follow_up_delay_hours')
      .eq('is_active', true);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list business centers for task maintenance: ${error.message}`);
    }

    return data as BusinessCenterRow[];
  }

  private async createFollowUpTasksForBusinessCenter(
    businessCenter: BusinessCenterRow,
    now: Date,
  ): Promise<number> {
    const delayHours = Math.max(businessCenter.ai_follow_up_delay_hours, 0);
    const cutoff = new Date(now.getTime() - delayHours * 60 * 60 * 1000).toISOString();
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversations')
      .select(
        'id, organization_id, business_center_id, contact_id, external_contact_id, customer_display_name, last_message_at, contacts(id, display_name, phone_number, lead_status)',
      )
      .eq('organization_id', businessCenter.organization_id)
      .eq('business_center_id', businessCenter.id)
      .eq('status', 'open')
      .not('last_message_at', 'is', null)
      .lte('last_message_at', cutoff)
      .order('last_message_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list idle conversations: ${error.message}`);
    }

    const taskRows = (data as ConversationRow[])
      .filter((conversation) => conversation.last_message_at && !this.shouldSkipFollowUp(conversation))
      .map((conversation) => this.toFollowUpTaskRow(conversation, now));

    const insertedTasks = await this.insertOwnerTasks(taskRows);
    await this.markContactsCold(insertedTasks.map((task) => task.contact_id));

    return insertedTasks.length;
  }

  private toFollowUpTaskRow(conversation: ConversationRow, now: Date): OwnerTaskInsertRow {
    const sourceKey = `follow_up:${conversation.id}:${conversation.last_message_at}`;
    const contact = getContact(conversation);
    const label =
      contact?.display_name ??
      conversation.customer_display_name ??
      contact?.phone_number ??
      conversation.external_contact_id;

    return {
      business_center_id: conversation.business_center_id,
      contact_id: conversation.contact_id,
      conversation_id: conversation.id,
      description: `No reply since ${conversation.last_message_at}. Review the conversation and follow up.`,
      due_at: now.toISOString(),
      metadata: {
        automation: 'cold_lead_follow_up',
      },
      organization_id: conversation.organization_id,
      priority: 'high',
      source_key: sourceKey,
      task_type: 'follow_up',
      title: `Follow up with ${label}`,
    };
  }

  private shouldSkipFollowUp(conversation: ConversationRow): boolean {
    const contact = getContact(conversation);
    return contact?.lead_status === 'won' || contact?.lead_status === 'lost';
  }

  private async insertOwnerTasks(rows: OwnerTaskInsertRow[]): Promise<InsertedOwnerTaskRow[]> {
    if (rows.length === 0) {
      return [];
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .upsert(rows, {
        ignoreDuplicates: true,
        onConflict: 'source_key',
      })
      .select('id, contact_id');

    if (error) {
      throw new Error(`Failed to create follow-up task: ${error.message}`);
    }

    return data as InsertedOwnerTaskRow[];
  }

  private async markContactsCold(contactIds: Array<string | null>): Promise<void> {
    const uniqueContactIds = [...new Set(contactIds.filter((contactId): contactId is string => Boolean(contactId)))];
    if (uniqueContactIds.length === 0) {
      return;
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('contacts')
      .update({ lead_status: 'cold' })
      .in('id', uniqueContactIds)
      .in('lead_status', ['new', 'active']);

    if (error) {
      throw new Error(`Failed to mark idle lead cold: ${error.message}`);
    }
  }

  private async createLowStockAlertsForBusinessCenter(businessCenter: BusinessCenterRow): Promise<{
    alertsCreated: number;
    pushNotificationsFailed: number;
    pushNotificationsSent: number;
  }> {
    const products = await this.inventoryService.listLowStockProducts({
      businessCenterId: businessCenter.id,
      organizationId: businessCenter.organization_id,
    });
    const notifications = await this.insertLowStockNotifications(products);
    const tokens = await this.listOwnerDeviceTokens({
      businessCenterId: businessCenter.id,
      organizationId: businessCenter.organization_id,
    });
    const productsBySourceKey = new Map(
      products.map((product) => [this.getLowStockSourceKey(product), product]),
    );
    const pushResults = await mapWithConcurrency(
      notifications,
      TASK_MAINTENANCE_CONCURRENCY,
      async (notification) => {
        const product = productsBySourceKey.get(notification.source_key);
        if (!product) {
          return { failed: 0, sent: 0 };
        }

        return this.sendLowStockPush({
          notificationId: notification.id,
          product,
          tokens,
        });
      },
    );

    return {
      alertsCreated: notifications.length,
      pushNotificationsFailed: pushResults.reduce((total, result) => total + result.failed, 0),
      pushNotificationsSent: pushResults.reduce((total, result) => total + result.sent, 0),
    };
  }

  private async insertLowStockNotifications(
    products: InventoryProduct[],
  ): Promise<InsertedNotificationRow[]> {
    if (products.length === 0) {
      return [];
    }

    const rows: LowStockNotificationInsertRow[] = products.map((product) => ({
      body: `${product.name} tiene ${product.stockQuantity} en stock; el umbral de reposición es ${product.reorderThreshold}.`,
      channel: 'stock',
      notification_type: 'stock.low',
      business_center_id: product.businessCenterId,
      organization_id: product.organizationId,
      payload: {
        productId: product.id,
        stockQuantity: product.stockQuantity,
        reorderThreshold: product.reorderThreshold,
      },
      product_id: product.id,
      source_key: this.getLowStockSourceKey(product),
      title: 'Stock bajo',
    }));
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_notifications')
      .upsert(rows, {
        ignoreDuplicates: true,
        onConflict: 'organization_id,source_key',
      })
      .select('id, product_id, source_key');

    if (error) {
      throw new Error(`Failed to create low-stock notification: ${error.message}`);
    }

    return data as InsertedNotificationRow[];
  }

  private getLowStockSourceKey(product: InventoryProduct): string {
    return [
      'stock.low',
      product.id,
      `stock:${product.stockQuantity}`,
      `threshold:${product.reorderThreshold}`,
    ].join(':');
  }

  private async sendLowStockPush(params: {
    notificationId: string;
    product: InventoryProduct;
    tokens: OwnerDeviceTokenRow[];
  }): Promise<{ failed: number; sent: number }> {
    if (params.tokens.length === 0) {
      return { failed: 0, sent: 0 };
    }

    const messages = params.tokens.map((token) => ({
      to: token.push_token,
      sound: 'default',
      title: 'Stock bajo',
      body: `${params.product.name} está en o por debajo del umbral de reposición.`,
      channelId: 'stock',
      data: {
        notificationId: params.notificationId,
        productId: params.product.id,
        type: 'stock.low',
      },
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const body = (await response.json()) as ExpoPushResponse;
      const failed = body.data?.filter((ticket) => ticket.status === 'error').length ?? 0;
      const sent = params.tokens.length - failed;

      await this.updateNotificationPushStatus({
        errorMessage:
          failed > 0 ? body.data?.find((ticket) => ticket.status === 'error')?.message : null,
        notificationId: params.notificationId,
        status: failed === params.tokens.length ? 'failed' : 'sent',
      });

      return { failed, sent };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown push error';
      await this.updateNotificationPushStatus({
        errorMessage: message,
        notificationId: params.notificationId,
        status: 'failed',
      });

      return { failed: params.tokens.length, sent: 0 };
    }
  }

  private async listOwnerDeviceTokens(params: {
    businessCenterId: string;
    organizationId: string;
  }): Promise<OwnerDeviceTokenRow[]> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_device_tokens')
      .select('push_token')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to list owner device tokens: ${error.message}`);
    }

    return data as OwnerDeviceTokenRow[];
  }

  private async updateNotificationPushStatus(params: {
    errorMessage: string | null | undefined;
    notificationId: string;
    status: 'sent' | 'failed';
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('owner_notifications')
      .update({
        error_message: params.errorMessage ?? null,
        push_sent_at: params.status === 'sent' ? new Date().toISOString() : null,
        status: params.status,
      })
      .eq('id', params.notificationId);

    if (error) {
      throw new Error(`Failed to update push notification status: ${error.message}`);
    }
  }
}

function emptyTaskMaintenanceResult(): TaskMaintenanceResult {
  return {
    followUpTasksCreated: 0,
    lowStockAlertsCreated: 0,
    notificationsCreated: 0,
    pushNotificationsFailed: 0,
    pushNotificationsSent: 0,
  };
}

function sumTaskMaintenanceResults(
  total: TaskMaintenanceResult,
  current: TaskMaintenanceResult,
): TaskMaintenanceResult {
  return {
    followUpTasksCreated: total.followUpTasksCreated + current.followUpTasksCreated,
    lowStockAlertsCreated: total.lowStockAlertsCreated + current.lowStockAlertsCreated,
    notificationsCreated: total.notificationsCreated + current.notificationsCreated,
    pushNotificationsFailed: total.pushNotificationsFailed + current.pushNotificationsFailed,
    pushNotificationsSent: total.pushNotificationsSent + current.pushNotificationsSent,
  };
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

function getContact(conversation: ConversationRow): ContactRow | null {
  if (Array.isArray(conversation.contacts)) {
    return conversation.contacts[0] ?? null;
  }

  return conversation.contacts;
}

function toOwnerTaskRecord(row: Record<string, unknown>): OwnerTaskRecord {
  const contacts = row.contacts as
    | { display_name: string | null; phone_number: string | null }
    | Array<{ display_name: string | null; phone_number: string | null }>
    | null
    | undefined;
  const contact = Array.isArray(contacts) ? contacts[0] : contacts;
  const contactLabel = contact?.display_name ?? contact?.phone_number ?? null;

  return {
    assignedToUserId: (row.assigned_to_user_id as string | null) ?? null,
    businessCenterId: (row.business_center_id as string | null) ?? '',
    contactId: (row.contact_id as string | null) ?? null,
    contactLabel,
    conversationId: (row.conversation_id as string | null) ?? null,
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    dueAt: (row.due_at as string | null) ?? null,
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? '',
    postponedUntil: (row.postponed_until as string | null) ?? null,
    priority: (row.priority as OwnerTaskRecord['priority']) ?? 'normal',
    reminderSnoozedUntil: (row.reminder_snoozed_until as string | null) ?? null,
    status: row.status as OwnerTaskStatus,
    taskType: (row.task_type as OwnerTaskType) ?? 'manual',
    title: row.title as string,
  };
}
