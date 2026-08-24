import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import {
  ADMIN_ROLES,
  DEFAULT_REMINDER_LEAD_MINUTES,
  NOTIFICATION_CATALOG,
  isNotificationTypeEnabled,
  normalizeReminderLeadMinutes,
  type NotificationTypeId,
  type ReminderLeadMinutes,
} from './notification.catalog';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CONCURRENCY = 5;
const INBOX_THROTTLE_MINUTES = 10;
const INVOICE_OVERDUE_DAYS = 30;
const DIGEST_HOUR = 8;
/** Remind the owner to confirm a Copi proposal only after this idle window. */
const COPI_ACTION_REMINDER_DELAY_MS = 5 * 60_000;

export interface NotificationPrefs {
  enabled: Record<string, boolean>;
  reminderLeadMinutes: ReminderLeadMinutes;
}

export interface EmitNotificationParams {
  body: string;
  businessCenterId: string;
  creatorUserId?: string | null;
  followerUserIds?: string[] | null;
  organizationId: string;
  payload?: Record<string, unknown>;
  productId?: string | null;
  sourceKey: string;
  targetUserId?: string | null;
  title?: string;
  type: NotificationTypeId;
}

export interface ScheduledNotificationsResult {
  notificationsCreated: number;
  pushFailed: number;
  pushSent: number;
}

interface DeviceTokenRow {
  push_token: string;
  user_id: string;
}

interface ExpoPushResponse {
  data?: Array<{ message?: string; status?: 'ok' | 'error' }>;
}

interface MemberRow {
  role: string;
  user_id: string;
}

interface PrefRow {
  enabled: Record<string, unknown> | null;
  reminder_lead_minutes: number;
  user_id: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getPrefs(params: {
    organizationId: string;
    userId: string;
  }): Promise<NotificationPrefs> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('user_notification_prefs')
      .select('reminder_lead_minutes, enabled')
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId)
      .maybeSingle<PrefRow>();

    if (error) {
      throw new Error(`Failed to load notification prefs: ${error.message}`);
    }

    return {
      enabled: (data?.enabled as Record<string, boolean> | null) ?? {},
      reminderLeadMinutes: normalizeReminderLeadMinutes(
        data?.reminder_lead_minutes ?? DEFAULT_REMINDER_LEAD_MINUTES,
      ),
    };
  }

  async upsertPrefs(params: {
    enabled?: Record<string, boolean>;
    organizationId: string;
    reminderLeadMinutes?: ReminderLeadMinutes;
    userId: string;
  }): Promise<NotificationPrefs> {
    const current = await this.getPrefs(params);
    const next: NotificationPrefs = {
      enabled: params.enabled ?? current.enabled,
      reminderLeadMinutes: params.reminderLeadMinutes ?? current.reminderLeadMinutes,
    };

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('user_notification_prefs').upsert(
      {
        enabled: next.enabled,
        organization_id: params.organizationId,
        reminder_lead_minutes: next.reminderLeadMinutes,
        user_id: params.userId,
      },
      { onConflict: 'organization_id,user_id' },
    );

    if (error) {
      throw new Error(`Failed to save notification prefs: ${error.message}`);
    }

    return next;
  }

  async emit(params: EmitNotificationParams): Promise<{ created: boolean; sent: number }> {
    const catalog = NOTIFICATION_CATALOG[params.type];
    const recipientIds = await this.resolveRecipients(params);
    if (recipientIds.length === 0) {
      return { created: false, sent: 0 };
    }

    const prefsByUser = await this.loadPrefsMap(params.organizationId, recipientIds);
    const enabledRecipients = recipientIds.filter((userId) =>
      isNotificationTypeEnabled(params.type, prefsByUser.get(userId)?.enabled),
    );
    if (enabledRecipients.length === 0) {
      return { created: false, sent: 0 };
    }

    const title = params.title ?? catalog.titleEs;
    const client = this.supabaseService.getServiceRoleClient();
    const row = {
      body: params.body,
      business_center_id: params.businessCenterId,
      channel: catalog.channel,
      notification_type: params.type,
      organization_id: params.organizationId,
      payload: params.payload ?? {},
      product_id: params.productId ?? null,
      source_key: params.sourceKey,
      target_user_id: params.targetUserId ?? null,
      title,
    };

    const { data, error } = await client
      .from('owner_notifications')
      .upsert(row, { ignoreDuplicates: true, onConflict: 'organization_id,source_key' })
      .select('id, source_key')
      .maybeSingle<{ id: string; source_key: string }>();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    // Upsert with ignoreDuplicates returns null when duplicate
    if (!data?.id) {
      return { created: false, sent: 0 };
    }

    const tokens = await this.listDeviceTokens({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      userIds: enabledRecipients,
    });

    const push = await this.sendExpoPush({
      body: params.body,
      channelId: catalog.channel,
      data: {
        notificationId: data.id,
        type: params.type,
        ...(params.payload ?? {}),
      },
      notificationId: data.id,
      title,
      tokens,
    });

    return { created: true, sent: push.sent };
  }

  async runScheduled(params: { now?: Date; organizationId?: string } = {}): Promise<ScheduledNotificationsResult> {
    const now = params.now ?? new Date();
    const orgs = await this.listOrganizations(params.organizationId);
    let created = 0;
    let pushSent = 0;
    let pushFailed = 0;

    const copiReminders = await this.notifyStaleCopiActionProposals({
      now,
      organizationId: params.organizationId,
    });
    created += copiReminders.created;
    pushSent += copiReminders.sent;

    for (const org of orgs) {
      const centers = await this.listCenters(org.id);
      for (const center of centers) {
        const digest = await this.maybeSendDigests({
          businessCenterId: center.id,
          now,
          organizationId: org.id,
          timezone: org.timezone,
        });
        created += digest.created;
        pushSent += digest.sent;

        const taskResult = await this.sendTaskScheduleNotifications({
          businessCenterId: center.id,
          now,
          organizationId: org.id,
        });
        created += taskResult.created;
        pushSent += taskResult.sent;

        const appointmentResult = await this.sendAppointmentScheduleNotifications({
          businessCenterId: center.id,
          now,
          organizationId: org.id,
        });
        created += appointmentResult.created;
        pushSent += appointmentResult.sent;

        const inboxResult = await this.sendInboxUnanswered({
          businessCenterId: center.id,
          followUpDelayHours: center.followUpDelayHours,
          now,
          organizationId: org.id,
        });
        created += inboxResult.created;
        pushSent += inboxResult.sent;

        const invoiceResult = await this.sendInvoiceOverdue({
          businessCenterId: center.id,
          now,
          organizationId: org.id,
        });
        created += invoiceResult.created;
        pushSent += invoiceResult.sent;
      }
    }

    return { notificationsCreated: created, pushFailed, pushSent };
  }

  async notifyTaskAssigned(params: {
    assignedToUserId: string;
    businessCenterId: string;
    organizationId: string;
    taskId: string;
    title: string;
  }): Promise<void> {
    await this.emit({
      body: `Te asignaron: ${params.title}`,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      payload: { taskId: params.taskId },
      sourceKey: `task.assigned:${params.taskId}:${params.assignedToUserId}`,
      targetUserId: params.assignedToUserId,
      type: 'task.assigned',
    });
  }

  async notifyTaskStatusChanged(params: {
    actorUserId?: string | null;
    businessCenterId: string;
    creatorUserId: string | null;
    followerUserIds?: string[];
    newStatus: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
    organizationId: string;
    postponedUntil?: string | null;
    taskId: string;
    title: string;
  }): Promise<void> {
    const body = formatStatusChangedBody(params.newStatus, params.title, params.postponedUntil);
    const stamp =
      params.newStatus === 'postponed' && params.postponedUntil
        ? params.postponedUntil
        : Date.now().toString();
    await this.emit({
      body,
      businessCenterId: params.businessCenterId,
      creatorUserId: params.creatorUserId ?? null,
      followerUserIds: params.followerUserIds ?? [],
      organizationId: params.organizationId,
      payload: {
        actorUserId: params.actorUserId ?? null,
        newStatus: params.newStatus,
        postponedUntil: params.postponedUntil ?? null,
        taskId: params.taskId,
      },
      sourceKey: `task.status_changed:${params.taskId}:${params.newStatus}:${stamp}`,
      type: 'task.status_changed',
    });
  }

  async notifyAppointmentAssigned(params: {
    assignedToUserId: string;
    appointmentId: string;
    businessCenterId: string;
    organizationId: string;
    title: string;
  }): Promise<void> {
    await this.emit({
      body: `Te asignaron el turno: ${params.title}`,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      payload: { appointmentId: params.appointmentId },
      sourceKey: `appointment.assigned:${params.appointmentId}:${params.assignedToUserId}`,
      targetUserId: params.assignedToUserId,
      type: 'appointment.assigned',
    });
  }

  async notifyInboxNewMessage(params: {
    bodyPreview: string | null;
    businessCenterId: string;
    conversationId: string;
    messageId: string;
    organizationId: string;
    senderLabel: string;
  }): Promise<void> {
    const preview = (params.bodyPreview ?? '').trim().slice(0, 120);
    await this.emit({
      body: preview
        ? `${params.senderLabel}: ${preview}`
        : `${params.senderLabel} te escribió`,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      payload: { conversationId: params.conversationId, messageId: params.messageId },
      sourceKey: `inbox.new_message:${params.conversationId}:${Math.floor(Date.now() / (INBOX_THROTTLE_MINUTES * 60_000))}`,
      type: 'inbox.new_message',
    });
  }

  async notifyCopiActionNeeded(params: {
    actionId: string;
    actionType?: string;
    assigneeName?: string | null;
    businessCenterId: string;
    description?: string | null;
    dueAt?: string | null;
    organizationId: string;
    summary: string;
    title?: string | null;
    userId: string;
  }): Promise<void> {
    await this.emit({
      body: params.summary,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      payload: {
        actionId: params.actionId,
        actionType: params.actionType ?? null,
        assigneeName: params.assigneeName ?? null,
        description: params.description ?? null,
        dueAt: params.dueAt ?? null,
        title: params.title ?? null,
      },
      sourceKey: `copi.action_needed:${params.actionId}`,
      targetUserId: params.userId,
      type: 'copi.action_needed',
    });
  }

  /** Dismiss the reminder once the owner confirms in Copi chat. */
  async dismissCopiActionNeeded(actionId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('owner_notifications')
      .update({ status: 'dismissed' })
      .eq('source_key', `copi.action_needed:${actionId}`)
      .neq('status', 'dismissed');

    if (error) {
      this.logger.warn(`Failed to dismiss copi.action_needed for ${actionId}: ${error.message}`);
    }
  }

  /**
   * After 5 minutes without confirm, nudge the owner. Skips executed proposals;
   * source_key upsert prevents duplicates.
   */
  async notifyStaleCopiActionProposals(params: {
    now: Date;
    organizationId?: string;
  }): Promise<{ created: number; sent: number }> {
    const cutoff = new Date(params.now.getTime() - COPI_ACTION_REMINDER_DELAY_MS).toISOString();
    const client = this.supabaseService.getServiceRoleClient();
    let query = client
      .from('copi_action_proposals')
      .select('id, action_type, business_center_id, organization_id, payload, user_id')
      .eq('status', 'pending')
      .lte('created_at', cutoff)
      .gt('expires_at', params.now.toISOString())
      .limit(100);

    if (params.organizationId) {
      query = query.eq('organization_id', params.organizationId);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list stale Copi proposals: ${error.message}`);
      return { created: 0, sent: 0 };
    }

    let created = 0;
    let sent = 0;
    for (const row of (data ?? []) as Array<{
      action_type: string;
      business_center_id: string;
      id: string;
      organization_id: string;
      payload: Record<string, unknown>;
      user_id: string;
    }>) {
      const details = extractCopiProposalDetails(row.action_type, row.payload);
      try {
        const result = await this.emit({
          body: details.summary,
          businessCenterId: row.business_center_id,
          organizationId: row.organization_id,
          payload: {
            actionId: row.id,
            actionType: row.action_type,
            assigneeName: details.assigneeName,
            description: details.description,
            dueAt: details.dueAt,
            title: details.title,
          },
          sourceKey: `copi.action_needed:${row.id}`,
          targetUserId: row.user_id,
          type: 'copi.action_needed',
        });
        if (result.created) {
          created += 1;
        }
        sent += result.sent;
      } catch (emitError) {
        this.logger.error('Failed to emit copi.action_needed reminder', {
          actionId: row.id,
          error: emitError instanceof Error ? emitError.message : emitError,
        });
      }
    }

    return { created, sent };
  }

  async notifyTeamInviteAccepted(params: {
    businessCenterId: string;
    displayName: string;
    organizationId: string;
    userId: string;
  }): Promise<void> {
    await this.emit({
      body: `${params.displayName} se unió al equipo`,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      payload: { joinedUserId: params.userId },
      sourceKey: `team.invite_accepted:${params.organizationId}:${params.userId}`,
      type: 'team.invite_accepted',
    });
  }

  async notifyClientEvent(params: {
    body: string;
    businessCenterId: string;
    creatorUserId?: string | null;
    organizationId: string;
    payload?: Record<string, unknown>;
    sourceKey: string;
    title?: string;
    type: NotificationTypeId;
  }): Promise<{ created: boolean; sent: number }> {
    return this.emit(params);
  }

  private async resolveRecipients(params: EmitNotificationParams): Promise<string[]> {
    const audience = NOTIFICATION_CATALOG[params.type].audience;
    if (audience === 'assignee' || audience === 'user') {
      return params.targetUserId ? [params.targetUserId] : [];
    }

    if (audience === 'creator_and_followers') {
      const recipients = new Set<string>();
      if (params.creatorUserId) {
        recipients.add(params.creatorUserId);
      }
      for (const userId of params.followerUserIds ?? []) {
        if (userId) {
          recipients.add(userId);
        }
      }
      return [...recipients];
    }

    const admins = await this.listAdminUserIds(params.organizationId);
    if (audience === 'creator_and_admins' && params.creatorUserId) {
      return [...new Set([...admins, params.creatorUserId])];
    }
    return admins;
  }

  private async listAdminUserIds(organizationId: string): Promise<string[]> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .in('role', [...ADMIN_ROLES]);

    if (error) {
      throw new Error(`Failed to list admin members: ${error.message}`);
    }

    return ((data ?? []) as MemberRow[]).map((row) => row.user_id);
  }

  private async loadPrefsMap(
    organizationId: string,
    userIds: string[],
  ): Promise<Map<string, NotificationPrefs>> {
    const map = new Map<string, NotificationPrefs>();
    if (userIds.length === 0) {
      return map;
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('user_notification_prefs')
      .select('user_id, reminder_lead_minutes, enabled')
      .eq('organization_id', organizationId)
      .in('user_id', userIds);

    if (error) {
      throw new Error(`Failed to load prefs map: ${error.message}`);
    }

    for (const row of (data ?? []) as PrefRow[]) {
      map.set(row.user_id, {
        enabled: (row.enabled as Record<string, boolean> | null) ?? {},
        reminderLeadMinutes: normalizeReminderLeadMinutes(row.reminder_lead_minutes),
      });
    }

    for (const userId of userIds) {
      if (!map.has(userId)) {
        map.set(userId, { enabled: {}, reminderLeadMinutes: DEFAULT_REMINDER_LEAD_MINUTES });
      }
    }

    return map;
  }

  private async listDeviceTokens(params: {
    businessCenterId: string;
    organizationId: string;
    userIds: string[];
  }): Promise<DeviceTokenRow[]> {
    if (params.userIds.length === 0) {
      return [];
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_device_tokens')
      .select('push_token, user_id, business_center_id')
      .eq('organization_id', params.organizationId)
      .eq('is_active', true)
      .in('user_id', params.userIds);

    if (error) {
      throw new Error(`Failed to list device tokens: ${error.message}`);
    }

    const rows = (data ?? []) as Array<DeviceTokenRow & { business_center_id: string | null }>;
    const centerScoped = rows.filter((row) => row.business_center_id === params.businessCenterId);
    const selected = centerScoped.length > 0 ? centerScoped : rows;
    return selected.map((row) => ({ push_token: row.push_token, user_id: row.user_id }));
  }

  private async sendExpoPush(params: {
    body: string;
    channelId: string;
    data: Record<string, unknown>;
    notificationId: string;
    title: string;
    tokens: DeviceTokenRow[];
  }): Promise<{ failed: number; sent: number }> {
    if (params.tokens.length === 0) {
      return { failed: 0, sent: 0 };
    }

    const messages = params.tokens.map((token) => ({
      to: token.push_token,
      sound: 'default' as const,
      title: params.title,
      body: params.body,
      channelId: params.channelId,
      data: params.data,
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

      await this.updatePushStatus({
        errorMessage:
          failed > 0 ? body.data?.find((ticket) => ticket.status === 'error')?.message ?? null : null,
        notificationId: params.notificationId,
        status: failed === params.tokens.length ? 'failed' : 'sent',
      });

      return { failed, sent };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown push error';
      this.logger.error(`Expo push failed: ${message}`);
      await this.updatePushStatus({
        errorMessage: message,
        notificationId: params.notificationId,
        status: 'failed',
      });
      return { failed: params.tokens.length, sent: 0 };
    }
  }

  private async updatePushStatus(params: {
    errorMessage: string | null;
    notificationId: string;
    status: 'sent' | 'failed';
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    await client
      .from('owner_notifications')
      .update({
        error_message: params.errorMessage,
        push_sent_at: params.status === 'sent' ? new Date().toISOString() : null,
        status: params.status,
      })
      .eq('id', params.notificationId);
  }

  private async listOrganizations(
    organizationId?: string,
  ): Promise<Array<{ id: string; timezone: string }>> {
    const client = this.supabaseService.getServiceRoleClient();
    let query = client.from('organizations').select('id, timezone');
    if (organizationId) {
      query = query.eq('id', organizationId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list organizations: ${error.message}`);
    }
    return ((data ?? []) as Array<{ id: string; timezone: string | null }>).map((row) => ({
      id: row.id,
      timezone: row.timezone || 'America/Argentina/Cordoba',
    }));
  }

  private async listCenters(
    organizationId: string,
  ): Promise<Array<{ followUpDelayHours: number; id: string }>> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id, ai_follow_up_delay_hours')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to list centers: ${error.message}`);
    }

    return ((data ?? []) as Array<{ ai_follow_up_delay_hours: number; id: string }>).map(
      (row) => ({
        followUpDelayHours: row.ai_follow_up_delay_hours ?? 24,
        id: row.id,
      }),
    );
  }

  private async maybeSendDigests(params: {
    businessCenterId: string;
    now: Date;
    organizationId: string;
    timezone: string;
  }): Promise<{ created: number; sent: number }> {
    const local = this.zonedParts(params.now, params.timezone);
    if (local.hour !== DIGEST_HOUR) {
      return { created: 0, sent: 0 };
    }

    let created = 0;
    let sent = 0;
    const dayKey = `${local.year}-${local.month}-${local.day}`;

    const summary = await this.buildDigestSummary({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      timezone: params.timezone,
    });

    const daily = await this.emit({
      body: summary,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      sourceKey: `digest.daily:${params.organizationId}:${params.businessCenterId}:${dayKey}`,
      type: 'digest.daily',
    });
    if (daily.created) {
      created += 1;
      sent += daily.sent;
    }

    // Monday = 1 in JS getDay when using en-US weekday... use local weekday from formatter
    if (local.weekday === 1) {
      const weekKey = `${local.year}-W${local.week}`;
      const weekly = await this.emit({
        body: `Resumen semanal · ${summary}`,
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
        sourceKey: `digest.weekly:${params.organizationId}:${params.businessCenterId}:${weekKey}`,
        type: 'digest.weekly',
      });
      if (weekly.created) {
        created += 1;
        sent += weekly.sent;
      }
    }

    return { created, sent };
  }

  private async buildDigestSummary(params: {
    businessCenterId: string;
    organizationId: string;
    timezone: string;
  }): Promise<string> {
    const client = this.supabaseService.getServiceRoleClient();
    const startOfDay = this.startOfZonedDayIso(new Date(), params.timezone);
    const endOfDay = this.endOfZonedDayIso(new Date(), params.timezone);

    const [openChats, pendingTasks, appointments, lowStockCount] = await Promise.all([
      client
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', params.organizationId)
        .eq('business_center_id', params.businessCenterId)
        .eq('status', 'open'),
      client
        .from('owner_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', params.organizationId)
        .eq('business_center_id', params.businessCenterId)
        .in('status', ['pending', 'in_progress', 'postponed']),
      client
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', params.organizationId)
        .eq('business_center_id', params.businessCenterId)
        .eq('status', 'scheduled')
        .gte('starts_at', startOfDay)
        .lt('starts_at', endOfDay),
      this.countLowStock(params.organizationId, params.businessCenterId),
    ]);

    const chats = openChats.count ?? 0;
    const tasks = pendingTasks.count ?? 0;
    const turnos = appointments.count ?? 0;

    return `Hoy: ${chats} chats abiertos, ${tasks} tareas pendientes, ${lowStockCount} con bajo stock, ${turnos} turnos.`;
  }

  private async countLowStock(organizationId: string, businessCenterId: string): Promise<number> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('products')
      .select('id, stock_quantity, reorder_threshold')
      .eq('organization_id', organizationId)
      .eq('business_center_id', businessCenterId)
      .eq('is_active', true);

    if (error) {
      return 0;
    }

    return ((data ?? []) as Array<{ reorder_threshold: number; stock_quantity: number }>).filter(
      (row) => row.stock_quantity <= row.reorder_threshold,
    ).length;
  }

  private async sendTaskScheduleNotifications(params: {
    businessCenterId: string;
    now: Date;
    organizationId: string;
  }): Promise<{ created: number; sent: number }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .select(
        'id, title, due_at, postponed_until, reminder_snoozed_until, status, assigned_to_user_id, created_by_user_id',
      )
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .in('status', ['pending', 'in_progress', 'postponed']);

    if (error) {
      throw new Error(`Failed to list tasks for reminders: ${error.message}`);
    }

    let created = 0;
    let sent = 0;
    const rows = (data ?? []) as Array<{
      assigned_to_user_id: string | null;
      created_by_user_id: string | null;
      due_at: string | null;
      id: string;
      postponed_until: string | null;
      reminder_snoozed_until: string | null;
      status: string;
      title: string;
    }>;

    if (rows.length === 0) {
      return { created, sent };
    }

    const followersByTaskId = await this.loadFollowersByTaskId(
      params.organizationId,
      rows.map((row) => row.id),
    );
    const anchorUserIds = new Set<string>();
    for (const row of rows) {
      if (row.created_by_user_id) anchorUserIds.add(row.created_by_user_id);
      if (row.assigned_to_user_id) anchorUserIds.add(row.assigned_to_user_id);
      for (const userId of followersByTaskId.get(row.id) ?? []) {
        anchorUserIds.add(userId);
      }
    }
    const prefs = await this.loadPrefsMap(params.organizationId, [...anchorUserIds]);

    for (const task of rows) {
      const anchorForLead = task.created_by_user_id ?? task.assigned_to_user_id;
      const lead = anchorForLead
        ? prefs.get(anchorForLead)?.reminderLeadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES
        : DEFAULT_REMINDER_LEAD_MINUTES;
      const followerUserIds = followersByTaskId.get(task.id) ?? [];

      if (task.status === 'postponed' && task.postponed_until) {
        const wakeAt = new Date(task.postponed_until).getTime();
        if (wakeAt <= params.now.getTime() && wakeAt > params.now.getTime() - 15 * 60_000) {
          const result = await this.emit({
            body: `Se reactivó: ${task.title}`,
            businessCenterId: params.businessCenterId,
            creatorUserId: task.created_by_user_id,
            followerUserIds,
            organizationId: params.organizationId,
            payload: { taskId: task.id },
            sourceKey: `task.postpone_wake:${task.id}:${task.postponed_until}`,
            type: 'task.postpone_wake',
          });
          if (result.created) {
            created += 1;
            sent += result.sent;
          }
        }
      }

      // Reminder snooze wake (silenciar 10 min): fire reminder when period ends.
      if (task.reminder_snoozed_until) {
        const snoozeWakeAt = new Date(task.reminder_snoozed_until).getTime();
        if (
          snoozeWakeAt <= params.now.getTime() &&
          snoozeWakeAt > params.now.getTime() - 15 * 60_000
        ) {
          const result = await this.emit({
            body: `Recordatorio: ${task.title}`,
            businessCenterId: params.businessCenterId,
            creatorUserId: task.created_by_user_id,
            followerUserIds,
            organizationId: params.organizationId,
            payload: { taskId: task.id },
            sourceKey: `task.reminder:snooze_wake:${task.id}:${task.reminder_snoozed_until}`,
            type: 'task.reminder',
          });
          if (result.created) {
            created += 1;
            sent += result.sent;
          }
          await client
            .from('owner_tasks')
            .update({ reminder_snoozed_until: null })
            .eq('id', task.id)
            .eq('organization_id', params.organizationId);
        }
      }

      if (!task.due_at) {
        continue;
      }

      // Skip reminder while user snoozed reminder (silenciar 10 min).
      const reminderSnoozedUntil = task.reminder_snoozed_until
        ? new Date(task.reminder_snoozed_until).getTime()
        : 0;
      const isReminderSnoozed = reminderSnoozedUntil > params.now.getTime();

      const dueAt = new Date(task.due_at).getTime();
      const reminderAt = dueAt - lead * 60_000;
      if (
        !isReminderSnoozed &&
        reminderAt <= params.now.getTime() &&
        reminderAt > params.now.getTime() - 15 * 60_000 &&
        dueAt > params.now.getTime()
      ) {
        const result = await this.emit({
          body: `En ${lead} min: ${task.title}`,
          businessCenterId: params.businessCenterId,
          creatorUserId: task.created_by_user_id,
          followerUserIds,
          organizationId: params.organizationId,
          payload: { taskId: task.id },
          sourceKey: `task.reminder:${task.id}:${task.due_at}:${lead}`,
          type: 'task.reminder',
        });
        if (result.created) {
          created += 1;
          sent += result.sent;
        }
      }

      if (
        !isReminderSnoozed &&
        dueAt <= params.now.getTime() &&
        dueAt > params.now.getTime() - 15 * 60_000
      ) {
        const result = await this.emit({
          body: `Vencida: ${task.title}`,
          businessCenterId: params.businessCenterId,
          creatorUserId: task.created_by_user_id,
          followerUserIds,
          organizationId: params.organizationId,
          payload: { taskId: task.id },
          sourceKey: `task.overdue:${task.id}:${task.due_at}`,
          type: 'task.overdue',
        });
        if (result.created) {
          created += 1;
          sent += result.sent;
        }
      }
    }

    return { created, sent };
  }

  private async loadFollowersByTaskId(
    organizationId: string,
    taskIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (taskIds.length === 0) {
      return map;
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_task_followers')
      .select('task_id, user_id')
      .eq('organization_id', organizationId)
      .in('task_id', taskIds);

    if (error) {
      this.logger.warn(`Failed to list task followers: ${error.message}`);
      return map;
    }

    for (const row of (data ?? []) as Array<{ task_id: string; user_id: string }>) {
      const list = map.get(row.task_id) ?? [];
      list.push(row.user_id);
      map.set(row.task_id, list);
    }
    return map;
  }

  private async sendAppointmentScheduleNotifications(params: {
    businessCenterId: string;
    now: Date;
    organizationId: string;
  }): Promise<{ created: number; sent: number }> {
    const client = this.supabaseService.getServiceRoleClient();
    const horizon = new Date(params.now.getTime() + 24 * 60 * 60_000).toISOString();
    const { data, error } = await client
      .from('appointments')
      .select('id, title, starts_at, assigned_to_user_id, created_by_user_id')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('status', 'scheduled')
      .gte('starts_at', params.now.toISOString())
      .lte('starts_at', horizon);

    if (error) {
      // Appointments table may be absent on older envs
      this.logger.warn(`Appointment reminders skipped: ${error.message}`);
      return { created: 0, sent: 0 };
    }

    let created = 0;
    let sent = 0;
    const rows = (data ?? []) as Array<{
      assigned_to_user_id: string | null;
      created_by_user_id: string | null;
      id: string;
      starts_at: string;
      title: string;
    }>;

    const userIds = [
      ...new Set(
        rows
          .flatMap((row) => [row.assigned_to_user_id, row.created_by_user_id])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const prefs = await this.loadPrefsMap(params.organizationId, userIds);

    for (const appointment of rows) {
      const recipient =
        appointment.assigned_to_user_id ?? appointment.created_by_user_id ?? null;
      if (!recipient) {
        continue;
      }

      const lead =
        prefs.get(recipient)?.reminderLeadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES;
      const startsAt = new Date(appointment.starts_at).getTime();
      const reminderAt = startsAt - lead * 60_000;
      const startingAt = startsAt - 5 * 60_000;

      if (
        reminderAt <= params.now.getTime() &&
        reminderAt > params.now.getTime() - 15 * 60_000
      ) {
        const result = await this.emit({
          body: `En ${lead} min: ${appointment.title}`,
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          payload: { appointmentId: appointment.id },
          sourceKey: `appointment.reminder:${appointment.id}:${appointment.starts_at}:${lead}`,
          targetUserId: recipient,
          type: 'appointment.reminder',
        });
        if (result.created) {
          created += 1;
          sent += result.sent;
        }
      }

      if (
        startingAt <= params.now.getTime() &&
        startingAt > params.now.getTime() - 15 * 60_000
      ) {
        const result = await this.emit({
          body: `Empieza ahora: ${appointment.title}`,
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          payload: { appointmentId: appointment.id },
          sourceKey: `appointment.starting:${appointment.id}:${appointment.starts_at}`,
          targetUserId: recipient,
          type: 'appointment.starting',
        });
        if (result.created) {
          created += 1;
          sent += result.sent;
        }
      }
    }

    return { created, sent };
  }

  private async sendInboxUnanswered(params: {
    businessCenterId: string;
    followUpDelayHours: number;
    now: Date;
    organizationId: string;
  }): Promise<{ created: number; sent: number }> {
    const cutoff = new Date(
      params.now.getTime() - Math.max(params.followUpDelayHours, 0) * 60 * 60_000,
    ).toISOString();
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversations')
      .select('id, customer_display_name, external_contact_id, last_message_at')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('status', 'open')
      .not('last_message_at', 'is', null)
      .lte('last_message_at', cutoff)
      .limit(20);

    if (error) {
      throw new Error(`Failed to list unanswered conversations: ${error.message}`);
    }

    let created = 0;
    let sent = 0;
    for (const conversation of (data ?? []) as Array<{
      customer_display_name: string | null;
      external_contact_id: string;
      id: string;
      last_message_at: string;
    }>) {
      const label =
        conversation.customer_display_name ?? conversation.external_contact_id;
      const result = await this.emit({
        body: `${label} espera respuesta desde ${conversation.last_message_at}`,
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
        payload: { conversationId: conversation.id },
        sourceKey: `inbox.unanswered:${conversation.id}:${conversation.last_message_at}`,
        type: 'inbox.unanswered',
      });
      if (result.created) {
        created += 1;
        sent += result.sent;
      }
    }

    return { created, sent };
  }

  private async sendInvoiceOverdue(params: {
    businessCenterId: string;
    now: Date;
    organizationId: string;
  }): Promise<{ created: number; sent: number }> {
    const cutoff = new Date(
      params.now.getTime() - INVOICE_OVERDUE_DAYS * 24 * 60 * 60_000,
    )
      .toISOString()
      .slice(0, 10);

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('invoices')
      .select('id, customer_name, voucher_number, issue_date, total_amount_cents')
      .eq('organization_id', params.organizationId)
      .eq('arca_status', 'authorized')
      .lte('issue_date', cutoff)
      .limit(20);

    if (error) {
      this.logger.warn(`Invoice overdue skipped: ${error.message}`);
      return { created: 0, sent: 0 };
    }

    let created = 0;
    let sent = 0;
    for (const invoice of (data ?? []) as Array<{
      customer_name: string | null;
      id: string;
      issue_date: string;
      total_amount_cents: number;
      voucher_number: number | null;
    }>) {
      const label = invoice.customer_name ?? `Factura ${invoice.voucher_number ?? ''}`;
      const result = await this.emit({
        body: `${label} emitida el ${invoice.issue_date} sigue pendiente (+${INVOICE_OVERDUE_DAYS} días)`,
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
        payload: { invoiceId: invoice.id },
        sourceKey: `invoice.overdue:${invoice.id}:${invoice.issue_date}`,
        type: 'invoice.overdue',
      });
      if (result.created) {
        created += 1;
        sent += result.sent;
      }
    }

    return { created, sent };
  }

  private zonedParts(
    date: Date,
    timeZone: string,
  ): { day: string; hour: number; month: string; week: number; weekday: number; year: string } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(date);

    const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 0,
    };

    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = Number(get('hour'));
    const weekday = weekdayMap[get('weekday')] ?? 0;
    const week = this.isoWeekNumber(Number(year), Number(month), Number(day));

    return { day, hour, month, week, weekday, year };
  }

  private isoWeekNumber(year: number, month: number, day: number): number {
    const date = new Date(Date.UTC(year, month - 1, day));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  }

  private startOfZonedDayIso(date: Date, timeZone: string): string {
    const { year, month, day } = this.zonedParts(date, timeZone);
    return new Date(`${year}-${month}-${day}T00:00:00`).toISOString();
  }

  private endOfZonedDayIso(date: Date, timeZone: string): string {
    const { year, month, day } = this.zonedParts(date, timeZone);
    return new Date(`${year}-${month}-${day}T23:59:59`).toISOString();
  }
}

function formatStatusChangedBody(
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'postponed',
  title: string,
  postponedUntil?: string | null,
): string {
  switch (status) {
    case 'in_progress':
      return `Iniciada: ${title}`;
    case 'completed':
      return `Completada: ${title}`;
    case 'cancelled':
      return `Cancelada: ${title}`;
    case 'postponed': {
      if (postponedUntil) {
        const formatted = formatSpanishDate(postponedUntil);
        return `Pospuesta hasta ${formatted}: ${title}`;
      }
      return `Pospuesta: ${title}`;
    }
    default:
      return `Pendiente: ${title}`;
  }
}

function formatSpanishDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'America/Argentina/Cordoba',
  });
}

function extractCopiProposalDetails(
  actionType: string,
  payload: Record<string, unknown>,
): {
  assigneeName: string | null;
  description: string | null;
  dueAt: string | null;
  summary: string;
  title: string | null;
} {
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const firstTask =
    tasks[0] && typeof tasks[0] === 'object'
      ? (tasks[0] as Record<string, unknown>)
      : null;

  const title =
    (typeof firstTask?.title === 'string' && firstTask.title.trim()) ||
    (typeof payload.title === 'string' && payload.title.trim()) ||
    null;
  const description =
    (typeof firstTask?.description === 'string' && firstTask.description.trim()) ||
    (typeof payload.description === 'string' && payload.description.trim()) ||
    null;
  const dueAt =
    (typeof firstTask?.dueAt === 'string' && firstTask.dueAt) ||
    (typeof payload.dueAt === 'string' && payload.dueAt) ||
    null;
  const assigneeName =
    (typeof firstTask?.assigneeName === 'string' && firstTask.assigneeName.trim()) ||
    (typeof payload.assigneeName === 'string' && payload.assigneeName.trim()) ||
    null;

  const summary =
    actionType === 'create_task' && title
      ? `Crear tarea: ${title}${assigneeName ? ` (asignada a ${assigneeName})` : ''}${
          dueAt ? ` (vence ${formatSpanishDate(dueAt)})` : ''
        }`
      : typeof payload.question === 'string' && payload.question.trim()
        ? payload.question.trim().slice(0, 160)
        : `Copi espera tu confirmación (${actionType})`;

  return { assigneeName, description, dueAt, summary, title };
}
