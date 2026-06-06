import { Injectable } from '@nestjs/common';

import { InventoryService, type InventoryProduct } from '../inventory/inventory.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface TaskMaintenanceResult {
  followUpTasksCreated: number;
  lowStockAlertsCreated: number;
  pushNotificationsSent: number;
  pushNotificationsFailed: number;
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

interface InsertResult {
  created: boolean;
  id: string | null;
}

interface OwnerDeviceTokenRow {
  push_token: string;
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
    const result: TaskMaintenanceResult = {
      followUpTasksCreated: 0,
      lowStockAlertsCreated: 0,
      pushNotificationsSent: 0,
      pushNotificationsFailed: 0,
    };

    for (const businessCenter of businessCenters) {
      result.followUpTasksCreated += await this.createFollowUpTasksForBusinessCenter(
        businessCenter,
        now,
      );

      const lowStockResult = await this.createLowStockAlertsForBusinessCenter(businessCenter);
      result.lowStockAlertsCreated += lowStockResult.alertsCreated;
      result.pushNotificationsSent += lowStockResult.pushNotificationsSent;
      result.pushNotificationsFailed += lowStockResult.pushNotificationsFailed;
    }

    return result;
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

    let created = 0;

    for (const conversation of data as ConversationRow[]) {
      if (!conversation.last_message_at || this.shouldSkipFollowUp(conversation)) {
        continue;
      }

      const sourceKey = `follow_up:${conversation.id}:${conversation.last_message_at}`;
      const contact = getContact(conversation);
      const label =
        contact?.display_name ??
        conversation.customer_display_name ??
        contact?.phone_number ??
        conversation.external_contact_id;

      const insert = await this.insertOwnerTask({
        contactId: conversation.contact_id,
        businessCenterId: conversation.business_center_id,
        conversationId: conversation.id,
        description: `No reply since ${conversation.last_message_at}. Review the conversation and follow up.`,
        dueAt: now.toISOString(),
        organizationId: conversation.organization_id,
        sourceKey,
        title: `Follow up with ${label}`,
      });

      if (insert.created) {
        created += 1;
        await this.markContactCold(conversation.contact_id);
      }
    }

    return created;
  }

  private shouldSkipFollowUp(conversation: ConversationRow): boolean {
    const contact = getContact(conversation);
    return contact?.lead_status === 'won' || contact?.lead_status === 'lost';
  }

  private async insertOwnerTask(params: {
    businessCenterId: string;
    contactId: string | null;
    conversationId: string;
    description: string;
    dueAt: string;
    organizationId: string;
    sourceKey: string;
    title: string;
  }): Promise<InsertResult> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .insert({
        business_center_id: params.businessCenterId,
        contact_id: params.contactId,
        conversation_id: params.conversationId,
        description: params.description,
        due_at: params.dueAt,
        metadata: {
          automation: 'cold_lead_follow_up',
        },
        organization_id: params.organizationId,
        priority: 'high',
        source_key: params.sourceKey,
        task_type: 'follow_up',
        title: params.title,
      })
      .select('id')
      .single<{ id: string }>();

    if (error) {
      if (error.code === '23505') {
        return { created: false, id: null };
      }

      throw new Error(`Failed to create follow-up task: ${error.message}`);
    }

    return { created: true, id: data.id };
  }

  private async markContactCold(contactId: string | null): Promise<void> {
    if (!contactId) {
      return;
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('contacts')
      .update({ lead_status: 'cold' })
      .eq('id', contactId)
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
    let alertsCreated = 0;
    let pushNotificationsFailed = 0;
    let pushNotificationsSent = 0;

    for (const product of products) {
      const insert = await this.insertLowStockNotification(product);

      if (!insert.created || !insert.id) {
        continue;
      }

      alertsCreated += 1;

      const pushResult = await this.sendLowStockPush({
        notificationId: insert.id,
        product,
      });
      pushNotificationsSent += pushResult.sent;
      pushNotificationsFailed += pushResult.failed;
    }

    return {
      alertsCreated,
      pushNotificationsFailed,
      pushNotificationsSent,
    };
  }

  private async insertLowStockNotification(product: InventoryProduct): Promise<InsertResult> {
    const sourceKey = [
      'low_stock',
      product.id,
      `stock:${product.stockQuantity}`,
      `threshold:${product.reorderThreshold}`,
    ].join(':');
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_notifications')
      .insert({
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
        source_key: sourceKey,
        title: 'Low stock alert',
      })
      .select('id')
      .single<{ id: string }>();

    if (error) {
      if (error.code === '23505') {
        return { created: false, id: null };
      }

      throw new Error(`Failed to create low-stock notification: ${error.message}`);
    }

    return { created: true, id: data.id };
  }

  private async sendLowStockPush(params: {
    notificationId: string;
    product: InventoryProduct;
  }): Promise<{ failed: number; sent: number }> {
    const tokens = await this.listOwnerDeviceTokens({
      businessCenterId: params.product.businessCenterId,
      organizationId: params.product.organizationId,
    });

    if (tokens.length === 0) {
      return { failed: 0, sent: 0 };
    }

    const messages = tokens.map((token) => ({
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
      const sent = tokens.length - failed;

      await this.updateNotificationPushStatus({
        errorMessage:
          failed > 0 ? body.data?.find((ticket) => ticket.status === 'error')?.message : null,
        notificationId: params.notificationId,
        status: failed === tokens.length ? 'failed' : 'sent',
      });

      return { failed, sent };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown push error';
      await this.updateNotificationPushStatus({
        errorMessage: message,
        notificationId: params.notificationId,
        status: 'failed',
      });

      return { failed: tokens.length, sent: 0 };
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

function getContact(conversation: ConversationRow): ContactRow | null {
  if (Array.isArray(conversation.contacts)) {
    return conversation.contacts[0] ?? null;
  }

  return conversation.contacts;
}
