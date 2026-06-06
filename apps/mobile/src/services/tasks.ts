import { supabase } from '../lib/supabase';
import type { OwnerNotification, OwnerTask, OwnerTaskStatus } from '../types/tasks';

interface ContactRow {
  display_name: string | null;
  phone_number: string | null;
}

interface ConversationRow {
  external_contact_id: string | null;
}

interface OwnerTaskRow {
  contacts: ContactRow | ContactRow[] | null;
  conversation_id: string | null;
  conversations: ConversationRow | ConversationRow[] | null;
  description: string | null;
  due_at: string | null;
  id: string;
  snoozed_until: string | null;
  status: OwnerTaskStatus;
  title: string;
}

interface ProductRow {
  name: string;
  reorder_threshold: number;
  stock_quantity: number;
}

interface OwnerNotificationRow {
  body: string;
  created_at: string;
  error_message: string | null;
  id: string;
  products: ProductRow | ProductRow[] | null;
  push_sent_at: string | null;
  status: 'pending' | 'sent' | 'failed' | 'dismissed';
  title: string;
}

export async function getOwnerTasks(
  organizationId: string,
  businessCenterId: string,
): Promise<OwnerTask[]> {
  const { data, error } = await supabase
    .from('owner_tasks')
    .select(
      'id, conversation_id, title, description, status, due_at, snoozed_until, contacts(display_name, phone_number), conversations(external_contact_id)',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .in('status', ['pending', 'snoozed'])
    .order('due_at', { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as OwnerTaskRow[]).map(toOwnerTask);
}

export async function completeOwnerTask(
  organizationId: string,
  businessCenterId: string,
  taskId: string,
): Promise<void> {
  await updateOwnerTaskStatus(organizationId, businessCenterId, taskId, {
    completed_at: new Date().toISOString(),
    status: 'completed',
  });
}

export async function snoozeOwnerTask(
  organizationId: string,
  businessCenterId: string,
  taskId: string,
  snoozedUntil: Date,
): Promise<void> {
  const timestamp = snoozedUntil.toISOString();
  await updateOwnerTaskStatus(organizationId, businessCenterId, taskId, {
    due_at: timestamp,
    snoozed_until: timestamp,
    status: 'snoozed',
  });
}

export async function getOwnerNotifications(
  organizationId: string,
  businessCenterId: string,
): Promise<OwnerNotification[]> {
  const { data, error } = await supabase
    .from('owner_notifications')
    .select(
      'id, title, body, status, push_sent_at, error_message, created_at, products(name, stock_quantity, reorder_threshold)',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(5);

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
          handlers.onNotificationInsert(toOwnerNotification(payload.new as OwnerNotificationRow));
        }
        handlers.onRefresh();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

async function updateOwnerTaskStatus(
  organizationId: string,
  businessCenterId: string,
  taskId: string,
  updates: Record<string, string>,
): Promise<void> {
  const { error } = await supabase
    .from('owner_tasks')
    .update(updates)
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('id', taskId);

  if (error) {
    throw new Error(error.message);
  }
}

function toOwnerTask(row: OwnerTaskRow): OwnerTask {
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
  const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;

  return {
    contactLabel:
      contact?.display_name ?? contact?.phone_number ?? conversation?.external_contact_id ?? null,
    conversationId: row.conversation_id,
    description: row.description,
    dueAt: row.due_at,
    id: row.id,
    snoozedUntil: row.snoozed_until,
    status: row.status,
    title: row.title,
  };
}

function toOwnerNotification(row: OwnerNotificationRow): OwnerNotification {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;

  return {
    body: row.body,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    id: row.id,
    productLabel: product
      ? `${product.name}: ${product.stock_quantity}/${product.reorder_threshold}`
      : null,
    pushSentAt: row.push_sent_at,
    status: row.status,
    title: row.title,
  };
}
