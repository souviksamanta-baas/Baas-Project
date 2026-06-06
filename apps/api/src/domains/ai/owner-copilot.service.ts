import { Injectable } from '@nestjs/common';

import { InventoryService, type InventoryProduct } from '../inventory/inventory.service';
import { SupabaseService } from '../../supabase/supabase.service';

export type CopilotToolName = 'messages_today' | 'low_stock' | 'pending_follow_ups';

export interface OwnerCopilotResponse {
  answer: string;
  responseTimeMs: number;
  tools: CopilotToolName[];
}

interface MembershipRow {
  role: 'owner' | 'staff';
}

interface MessageRow {
  body: string | null;
  created_at: string;
  sender_phone: string | null;
}

interface TaskRow {
  due_at: string | null;
  title: string;
}

@Injectable()
export class OwnerCopilotService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly inventoryService: InventoryService,
  ) {}

  async answerQuestion(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
    question: string;
    now?: Date;
  }): Promise<OwnerCopilotResponse> {
    const startedAt = Date.now();
    await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    const tools = selectTools(params.question);
    const now = params.now ?? new Date();
    const businessCenterId = await this.getDefaultBusinessCenterId(params.organizationId);
    const [messagesToday, lowStockProducts, pendingTasks] = await Promise.all([
      tools.includes('messages_today')
        ? this.listMessagesToday(params.organizationId, businessCenterId, now)
        : Promise.resolve([]),
      tools.includes('low_stock')
        ? this.inventoryService.listLowStockProducts({
            businessCenterId,
            organizationId: params.organizationId,
          })
        : Promise.resolve([]),
      tools.includes('pending_follow_ups')
        ? this.listPendingFollowUps(params.organizationId, businessCenterId)
        : Promise.resolve([]),
    ]);

    return {
      answer: buildAnswer({
        lowStockProducts,
        messagesToday,
        pendingTasks,
        tools,
      }),
      responseTimeMs: Date.now() - startedAt,
      tools,
    };
  }

  private async listMessagesToday(
    organizationId: string,
    businessCenterId: string,
    now: Date,
  ): Promise<MessageRow[]> {
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversation_messages')
      .select('body, created_at, sender_phone')
      .eq('organization_id', organizationId)
      .eq('business_center_id', businessCenterId)
      .eq('direction', 'inbound')
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to load today's messages for copilot: ${error.message}`);
    }

    return data as MessageRow[];
  }

  private async listPendingFollowUps(
    organizationId: string,
    businessCenterId: string,
  ): Promise<TaskRow[]> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('owner_tasks')
      .select('title, due_at')
      .eq('organization_id', organizationId)
      .eq('business_center_id', businessCenterId)
      .in('status', ['pending', 'snoozed'])
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to load pending follow-ups for copilot: ${error.message}`);
    }

    return data as TaskRow[];
  }

  private async getDefaultBusinessCenterId(organizationId: string): Promise<string> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single<{ id: string }>();

    if (error) {
      throw new Error(`Failed to load default business center for copilot: ${error.message}`);
    }

    return data.id;
  }

  private async assertMember(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<string> {
    const token = params.authorizationHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      throw new Error('Missing bearer token');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);

    if (userError || !userData.user) {
      throw new Error('Invalid bearer token');
    }

    const { data, error } = await client
      .from('organization_members')
      .select('role')
      .eq('organization_id', params.organizationId)
      .eq('user_id', userData.user.id)
      .single<MembershipRow>();

    if (error || !data) {
      throw new Error('User is not a member of this organization');
    }

    return userData.user.id;
  }
}

function selectTools(question: string): CopilotToolName[] {
  const normalized = question.toLocaleLowerCase();
  const tools = new Set<CopilotToolName>();

  if (/\b(message|messages|chat|chats|inbox|today)\b/.test(normalized)) {
    tools.add('messages_today');
  }

  if (/\b(low stock|stock|inventory|reorder)\b/.test(normalized)) {
    tools.add('low_stock');
  }

  if (/\b(follow|follow-up|followup|task|tasks|pending)\b/.test(normalized)) {
    tools.add('pending_follow_ups');
  }

  if (tools.size === 0) {
    tools.add('messages_today');
    tools.add('low_stock');
    tools.add('pending_follow_ups');
  }

  return Array.from(tools);
}

function buildAnswer(params: {
  lowStockProducts: InventoryProduct[];
  messagesToday: MessageRow[];
  pendingTasks: TaskRow[];
  tools: CopilotToolName[];
}): string {
  const sections: string[] = [];

  if (params.tools.includes('messages_today')) {
    sections.push(buildMessagesTodaySection(params.messagesToday));
  }

  if (params.tools.includes('low_stock')) {
    sections.push(buildLowStockSection(params.lowStockProducts));
  }

  if (params.tools.includes('pending_follow_ups')) {
    sections.push(buildPendingTasksSection(params.pendingTasks));
  }

  return sections.join('\n\n');
}

function buildMessagesTodaySection(messages: MessageRow[]): string {
  if (messages.length === 0) {
    return 'Messages today: no inbound customer messages yet.';
  }

  const previews = messages.slice(0, 3).map((message) => {
    const body = message.body?.trim() || 'Non-text message';
    return `- ${message.sender_phone ?? 'Customer'}: ${truncate(body, 80)}`;
  });

  return [`Messages today: ${messages.length} inbound message(s).`, ...previews].join('\n');
}

function buildLowStockSection(products: InventoryProduct[]): string {
  if (products.length === 0) {
    return 'Low stock: no products are at or below reorder threshold.';
  }

  const previews = products.slice(0, 5).map((product) => {
    return `- ${product.name}: ${product.stockQuantity} in stock, reorder at ${product.reorderThreshold}.`;
  });

  return [`Low stock: ${products.length} item(s) need attention.`, ...previews].join('\n');
}

function buildPendingTasksSection(tasks: TaskRow[]): string {
  if (tasks.length === 0) {
    return 'Pending follow-ups: no pending or snoozed follow-up tasks.';
  }

  const previews = tasks.slice(0, 5).map((task) => {
    return `- ${task.title}${task.due_at ? `, due ${task.due_at}` : ''}.`;
  });

  return [`Pending follow-ups: ${tasks.length} task(s).`, ...previews].join('\n');
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
