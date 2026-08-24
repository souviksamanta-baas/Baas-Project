import { apiFetchAuthJson } from './client';
import { supabase } from '../lib/supabase';
import type {
  OwnerNotification,
  OwnerTask,
  OwnerTaskStatus,
  OwnerTaskType,
} from '../types/tasks';

interface OwnerTaskApiRow {
  assignedToUserId: string | null;
  businessCenterId: string;
  contactId: string | null;
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

interface ContactLookupRow {
  display_name: string | null;
  id: string;
  phone_number: string | null;
}

interface ConversationLookupRow {
  external_contact_id: string | null;
  id: string;
}

interface ProductRow {
  id: string;
  name: string;
  reorder_threshold: number;
  stock_quantity: number;
}

interface OwnerNotificationRow {
  body: string;
  created_at: string;
  error_message: string | null;
  id: string;
  notification_type: string;
  payload: {
    productId?: string;
    reorderThreshold?: number;
    stockQuantity?: number;
  } | null;
  product_id: string | null;
  products: ProductRow | ProductRow[] | null;
  push_sent_at: string | null;
  status: 'pending' | 'sent' | 'failed' | 'dismissed';
  title: string;
}

export interface OwnerTaskAssigneeInfo {
  displayName: string;
  userId: string;
}

export interface OwnerTaskContext {
  assignees: OwnerTaskAssigneeInfo[];
  followingTaskIds: Set<string>;
}

const DEFAULT_STATUSES: OwnerTaskStatus[] = ['pending', 'in_progress', 'postponed'];

function taskQuery(params: {
  businessCenterId: string;
  organizationId: string;
  statuses?: OwnerTaskStatus[];
  limit?: number;
}): string {
  const search = new URLSearchParams({
    businessCenterId: params.businessCenterId,
    organizationId: params.organizationId,
  });

  const statuses = params.statuses ?? DEFAULT_STATUSES;
  if (statuses.length > 0) {
    search.set('statuses', statuses.join(','));
  }

  if (params.limit) {
    search.set('limit', String(params.limit));
  } else {
    search.set('limit', '200');
  }

  return search.toString();
}

/**
 * Fetch tasks from the Nest API and enrich them with assignee, contact and
 * following context loaded straight from Supabase. Direct supabase reads are
 * kept for lookups that the REST endpoints don't expose today.
 */
export async function getOwnerTasks(params: {
  businessCenterId: string;
  currentUserId: string | null;
  organizationId: string;
  statuses?: OwnerTaskStatus[];
}): Promise<OwnerTask[]> {
  const rows = await apiFetchAuthJson<OwnerTaskApiRow[]>(
    `/tasks?${taskQuery({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      statuses: params.statuses,
    })}`,
  );

  return enrichTasks({
    currentUserId: params.currentUserId,
    organizationId: params.organizationId,
    rows,
  });
}

export async function getOwnerTask(params: {
  businessCenterId: string;
  currentUserId: string | null;
  organizationId: string;
  taskId: string;
}): Promise<OwnerTask | null> {
  try {
    const row = await apiFetchAuthJson<OwnerTaskApiRow>(
      `/tasks/${encodeURIComponent(params.taskId)}?${taskQuery({
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
      })}`,
    );
    const enriched = await enrichTasks({
      currentUserId: params.currentUserId,
      organizationId: params.organizationId,
      rows: [row],
    });
    return enriched[0] ?? null;
  } catch {
    return null;
  }
}

export interface CreateOwnerTaskInput {
  assignedToUserId: string;
  businessCenterId: string;
  contactId?: string | null;
  conversationId?: string | null;
  description: string;
  dueAt: string;
  organizationId: string;
  priority?: 'low' | 'normal' | 'high';
  title: string;
}

export async function createOwnerTask(input: CreateOwnerTaskInput): Promise<OwnerTask> {
  const row = await apiFetchAuthJson<OwnerTaskApiRow>('/tasks', {
    body: JSON.stringify({
      assignedToUserId: input.assignedToUserId,
      businessCenterId: input.businessCenterId,
      contactId: input.contactId ?? null,
      conversationId: input.conversationId ?? null,
      description: input.description,
      dueAt: input.dueAt,
      organizationId: input.organizationId,
      priority: input.priority ?? 'normal',
      title: input.title,
    }),
    method: 'POST',
  });

  const [task] = await enrichTasks({
    currentUserId: null,
    organizationId: input.organizationId,
    rows: [row],
  });
  return task!;
}

export async function startOwnerTask(params: {
  businessCenterId: string;
  organizationId: string;
  taskId: string;
}): Promise<OwnerTaskApiRow> {
  return apiFetchAuthJson<OwnerTaskApiRow>(
    `/tasks/${encodeURIComponent(params.taskId)}/start`,
    {
      body: JSON.stringify({
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
      }),
      method: 'POST',
    },
  );
}

export async function completeOwnerTask(params: {
  businessCenterId: string;
  organizationId: string;
  taskId: string;
}): Promise<OwnerTaskApiRow> {
  return apiFetchAuthJson<OwnerTaskApiRow>(
    `/tasks/${encodeURIComponent(params.taskId)}/complete`,
    {
      body: JSON.stringify({
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
      }),
      method: 'POST',
    },
  );
}

export async function cancelOwnerTask(params: {
  businessCenterId: string;
  organizationId: string;
  taskId: string;
}): Promise<OwnerTaskApiRow> {
  return apiFetchAuthJson<OwnerTaskApiRow>(
    `/tasks/${encodeURIComponent(params.taskId)}/cancel`,
    {
      body: JSON.stringify({
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
      }),
      method: 'POST',
    },
  );
}

export async function postponeOwnerTask(params: {
  businessCenterId: string;
  organizationId: string;
  postponedUntil: Date;
  taskId: string;
}): Promise<OwnerTaskApiRow> {
  return apiFetchAuthJson<OwnerTaskApiRow>(
    `/tasks/${encodeURIComponent(params.taskId)}/postpone`,
    {
      body: JSON.stringify({
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
        postponedUntil: params.postponedUntil.toISOString(),
      }),
      method: 'POST',
    },
  );
}

export async function snoozeOwnerTaskReminder(params: {
  businessCenterId: string;
  minutes?: number;
  organizationId: string;
  taskId: string;
}): Promise<OwnerTaskApiRow> {
  return apiFetchAuthJson<OwnerTaskApiRow>(
    `/tasks/${encodeURIComponent(params.taskId)}/snooze-reminder`,
    {
      body: JSON.stringify({
        businessCenterId: params.businessCenterId,
        minutes: params.minutes ?? 10,
        organizationId: params.organizationId,
      }),
      method: 'POST',
    },
  );
}

export async function reassignOwnerTask(params: {
  assignedToUserId: string;
  businessCenterId: string;
  organizationId: string;
  taskId: string;
}): Promise<OwnerTaskApiRow> {
  return apiFetchAuthJson<OwnerTaskApiRow>(
    `/tasks/${encodeURIComponent(params.taskId)}/assign`,
    {
      body: JSON.stringify({
        assignedToUserId: params.assignedToUserId,
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
      }),
      method: 'POST',
    },
  );
}

export async function followOwnerTask(params: {
  businessCenterId: string;
  organizationId: string;
  taskId: string;
}): Promise<{ added: boolean }> {
  return apiFetchAuthJson<{ added: boolean }>(
    `/tasks/${encodeURIComponent(params.taskId)}/followers`,
    {
      body: JSON.stringify({
        businessCenterId: params.businessCenterId,
        organizationId: params.organizationId,
      }),
      method: 'POST',
    },
  );
}

export async function unfollowOwnerTask(params: {
  organizationId: string;
  taskId: string;
}): Promise<{ removed: boolean }> {
  const search = new URLSearchParams({ organizationId: params.organizationId });
  return apiFetchAuthJson<{ removed: boolean }>(
    `/tasks/${encodeURIComponent(params.taskId)}/followers?${search.toString()}`,
    { method: 'DELETE' },
  );
}

export async function createAppointmentFromOwnerTask(params: {
  businessCenterId: string;
  endsAt?: string;
  notes?: string | null;
  organizationId: string;
  startsAt: string;
  taskId: string;
  title?: string;
}): Promise<{ appointmentId: string; startsAt: string; endsAt: string; title: string }> {
  return apiFetchAuthJson<{
    appointmentId: string;
    startsAt: string;
    endsAt: string;
    title: string;
  }>(`/tasks/${encodeURIComponent(params.taskId)}/appointments`, {
    body: JSON.stringify({
      businessCenterId: params.businessCenterId,
      endsAt: params.endsAt,
      notes: params.notes ?? null,
      organizationId: params.organizationId,
      startsAt: params.startsAt,
      title: params.title,
    }),
    method: 'POST',
  });
}

// -- Notifications ---------------------------------------------------------

export async function getOwnerNotifications(
  organizationId: string,
  businessCenterId: string,
  limit = 50,
): Promise<OwnerNotification[]> {
  const { data, error } = await supabase
    .from('owner_notifications')
    .select(
      'id, title, body, status, notification_type, payload, product_id, push_sent_at, error_message, created_at, products(id, name, stock_quantity, reorder_threshold)',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data as OwnerNotificationRow[]).map(toOwnerNotification);
}

export async function dismissOwnerNotification(
  organizationId: string,
  businessCenterId: string,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('owner_notifications')
    .update({ status: 'dismissed' })
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('id', notificationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function dismissAllOwnerNotifications(
  organizationId: string,
  businessCenterId: string,
): Promise<void> {
  const { error } = await supabase
    .from('owner_notifications')
    .update({ status: 'dismissed' })
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .neq('status', 'dismissed');

  if (error) {
    throw new Error(error.message);
  }
}

export async function registerOwnerPushToken(
  organizationId: string,
  businessCenterId: string,
  pushToken: string,
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user) {
    throw new Error('Sign in before registering push notifications.');
  }

  const { error } = await supabase.from('owner_device_tokens').upsert(
    {
      is_active: true,
      last_registered_at: new Date().toISOString(),
      business_center_id: businessCenterId,
      organization_id: organizationId,
      platform: 'expo',
      push_token: pushToken,
      user_id: user.id,
    },
    {
      onConflict: 'organization_id,user_id,push_token',
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export function subscribeToOwnerTaskChanges(
  organizationId: string,
  businessCenterId: string,
  handlers: {
    onNotificationInsert: (notification: OwnerNotification) => void;
    onRefresh: () => void;
  },
): () => void {
  const channel = supabase
    .channel(`owner-tasks:${organizationId}:${businessCenterId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'owner_tasks',
        filter: `business_center_id=eq.${businessCenterId}`,
      },
      () => {
        handlers.onRefresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'owner_notifications',
        filter: `business_center_id=eq.${businessCenterId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          handlers.onNotificationInsert(
            toOwnerNotification(payload.new as OwnerNotificationRow),
          );
        }
        handlers.onRefresh();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// -- Enrichment helpers ---------------------------------------------------

async function enrichTasks(params: {
  currentUserId: string | null;
  organizationId: string;
  rows: OwnerTaskApiRow[];
}): Promise<OwnerTask[]> {
  const rows = params.rows;
  if (rows.length === 0) {
    return [];
  }

  const contactIds = uniqueTruthy(rows.map((row) => row.contactId));
  const conversationIds = uniqueTruthy(rows.map((row) => row.conversationId));
  const assignedUserIds = uniqueTruthy(rows.map((row) => row.assignedToUserId));
  const taskIds = rows.map((row) => row.id);

  const [contactMap, conversationMap, followingSet] = await Promise.all([
    loadContacts(contactIds),
    loadConversations(conversationIds),
    params.currentUserId
      ? loadFollowerTaskIds({
          organizationId: params.organizationId,
          taskIds,
          userId: params.currentUserId,
        })
      : Promise.resolve(new Set<string>()),
  ]);
  // Assignee labels are looked up lazily by the hook (via the org members API).
  const assigneeLabels = new Map<string, string>();
  for (const userId of assignedUserIds) {
    assigneeLabels.set(userId, '');
  }

  return rows.map((row) => toOwnerTask(row, {
    contactMap,
    conversationMap,
    followingSet,
  }));
}

function toOwnerTask(
  row: OwnerTaskApiRow,
  ctx: {
    contactMap: Map<string, ContactLookupRow>;
    conversationMap: Map<string, ConversationLookupRow>;
    followingSet: Set<string>;
  },
): OwnerTask {
  const contact = row.contactId ? ctx.contactMap.get(row.contactId) ?? null : null;
  const conversation = row.conversationId
    ? ctx.conversationMap.get(row.conversationId) ?? null
    : null;
  const contactLabel =
    contact?.display_name ??
    contact?.phone_number ??
    conversation?.external_contact_id ??
    null;

  const combinedText = `${row.title}\n${row.description ?? ''}`;
  return {
    assignedToUserId: row.assignedToUserId,
    assigneeLabel: null,
    contactId: row.contactId,
    contactLabel,
    conversationId: row.conversationId,
    createdByUserId: row.createdByUserId,
    description: row.description,
    dueAt: row.dueAt,
    id: row.id,
    isFollowing: ctx.followingSet.has(row.id),
    metadata: {},
    postponedUntil: row.postponedUntil,
    presupuestoId: extractPresupuestoId(combinedText),
    priority: row.priority ?? 'normal',
    reminderSnoozedUntil: row.reminderSnoozedUntil,
    status: row.status,
    taskType: row.taskType ?? 'manual',
    title: row.title,
  };
}

async function loadContacts(ids: string[]): Promise<Map<string, ContactLookupRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('contacts')
    .select('id, display_name, phone_number')
    .in('id', ids);

  if (error) {
    return new Map();
  }

  const map = new Map<string, ContactLookupRow>();
  for (const row of (data as ContactLookupRow[]) ?? []) {
    map.set(row.id, row);
  }
  return map;
}

async function loadConversations(
  ids: string[],
): Promise<Map<string, ConversationLookupRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('id, external_contact_id')
    .in('id', ids);

  if (error) {
    return new Map();
  }

  const map = new Map<string, ConversationLookupRow>();
  for (const row of (data as ConversationLookupRow[]) ?? []) {
    map.set(row.id, row);
  }
  return map;
}

async function loadFollowerTaskIds(params: {
  organizationId: string;
  taskIds: string[];
  userId: string;
}): Promise<Set<string>> {
  if (params.taskIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('owner_task_followers')
    .select('task_id')
    .eq('organization_id', params.organizationId)
    .eq('user_id', params.userId)
    .in('task_id', params.taskIds);

  if (error) {
    return new Set();
  }

  const result = new Set<string>();
  for (const row of (data as Array<{ task_id: string }>) ?? []) {
    result.add(row.task_id);
  }
  return result;
}

function uniqueTruthy(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

/** Match sell_quotes ids like PRES-MSHZXECG. */
export function extractPresupuestoId(text: string): string | null {
  const match = text.match(/\bPRES-[A-Z0-9]+\b/i);
  return match?.[0]?.toUpperCase() ?? null;
}

function toOwnerNotification(row: OwnerNotificationRow): OwnerNotification {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  const productId = row.product_id ?? row.payload?.productId ?? product?.id ?? null;

  return {
    body: row.body,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    id: row.id,
    notificationType: row.notification_type,
    payload: row.payload ?? {},
    productId,
    productLabel: product
      ? `${product.name}: ${product.stock_quantity}/${product.reorder_threshold}`
      : null,
    pushSentAt: row.push_sent_at,
    status: row.status,
    title: row.title,
  };
}
