import { Injectable } from '@nestjs/common';

import { InventoryService, type InventoryProduct } from '../inventory/inventory.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface TaskMaintenanceResult {
  followUpTasksCreated: number;
  lowStockAlertsCreated: number;
  pushNotificationsSent: number;
  pushNotificationsFailed: number;
}

export type OwnerTaskStatus = 'pending' | 'completed' | 'snoozed' | 'cancelled';

export type OwnerTaskType = 'follow_up' | 'manual' | 'copi' | 'inventory' | 'callback';

export interface OwnerTaskRecord {
  assignedToUserId: string | null;
  contactId: string | null;
  conversationId: string | null;
  createdByUserId: string | null;
  description: string | null;
  dueAt: string | null;
  id: string;
  priority: 'low' | 'normal' | 'high';
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
  notification_type: 'low_stock';
  organization_id: string;
  payload: {
    productId: string;
    reorderThreshold: number;
    stockQuantity: number;
  };
  product_id: string;
  source_key: string;
  title: 'Low stock alert';
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

@Injectable()
export class TasksService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly inventoryService: InventoryService,
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

    return results.reduce(sumTaskMaintenanceResults, emptyTaskMaintenanceResult());
  }

  async listTasks(params: {
    assignedToUserId?: string;
    businessCenterId: string;
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
        'id, title, description, status, due_at, task_type, priority, contact_id, conversation_id, assigned_to_user_id, created_by_user_id, contacts(display_name, phone_number)',
      )
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(params.limit ?? 20);

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
      .select(
        'id, title, description, status, due_at, task_type, priority, contact_id, conversation_id, assigned_to_user_id, created_by_user_id',
      )
      .single();

    if (error) {
      throw new Error(`Failed to create owner task: ${error.message}`);
    }

    return toOwnerTaskRecord(data as Record<string, unknown>);
  }

  async updateTaskStatus(params: {
    businessCenterId: string;
    completedByUserId?: string;
    organizationId: string;
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

    if (params.status === 'snoozed' && params.snoozedUntil) {
      updates.snoozed_until = params.snoozedUntil;
      updates.due_at = params.snoozedUntil;
    }

    const { data, error } = await client
      .from('owner_tasks')
      .update(updates)
      .eq('id', params.taskId)
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .select(
        'id, title, description, status, due_at, task_type, priority, contact_id, conversation_id, assigned_to_user_id, created_by_user_id',
      )
      .single();

    if (error) {
      throw new Error(`Failed to update owner task: ${error.message}`);
    }

    return toOwnerTaskRecord(data as Record<string, unknown>);
  }

  async assignTask(params: {
    assignedToUserId: string;
    businessCenterId: string;
    organizationId: string;
    taskId: string;
  }): Promise<OwnerTaskRecord> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .update({ assigned_to_user_id: params.assignedToUserId })
      .eq('id', params.taskId)
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .select(
        'id, title, description, status, due_at, task_type, priority, contact_id, conversation_id, assigned_to_user_id, created_by_user_id',
      )
      .single();

    if (error) {
      throw new Error(`Failed to assign owner task: ${error.message}`);
    }

    return toOwnerTaskRecord(data as Record<string, unknown>);
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
      body: `${product.name} has ${product.stockQuantity} in stock; reorder threshold is ${product.reorderThreshold}.`,
      notification_type: 'low_stock',
      business_center_id: product.businessCenterId,
      organization_id: product.organizationId,
      payload: {
        productId: product.id,
        stockQuantity: product.stockQuantity,
        reorderThreshold: product.reorderThreshold,
      },
      product_id: product.id,
      source_key: this.getLowStockSourceKey(product),
      title: 'Low stock alert',
    }));
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_notifications')
      .upsert(rows, {
        ignoreDuplicates: true,
        onConflict: 'source_key',
      })
      .select('id, product_id, source_key');

    if (error) {
      throw new Error(`Failed to create low-stock notification: ${error.message}`);
    }

    return data as InsertedNotificationRow[];
  }

  private getLowStockSourceKey(product: InventoryProduct): string {
    return [
      'low_stock',
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
      title: 'Low stock alert',
      body: `${params.product.name} is at or below reorder threshold.`,
      data: {
        notificationId: params.notificationId,
        productId: params.product.id,
        type: 'low_stock',
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
  return {
    assignedToUserId: (row.assigned_to_user_id as string | null) ?? null,
    contactId: (row.contact_id as string | null) ?? null,
    conversationId: (row.conversation_id as string | null) ?? null,
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    dueAt: (row.due_at as string | null) ?? null,
    id: row.id as string,
    priority: (row.priority as OwnerTaskRecord['priority']) ?? 'normal',
    status: row.status as OwnerTaskStatus,
    taskType: (row.task_type as OwnerTaskType) ?? 'manual',
    title: row.title as string,
  };
}
