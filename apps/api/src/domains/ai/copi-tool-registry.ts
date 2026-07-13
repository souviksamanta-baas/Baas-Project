import { Injectable } from '@nestjs/common';

import { InventoryService } from '../inventory/inventory.service';
import { TasksService } from '../tasks/tasks.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { getZonedDayBounds, normalizeTimeZone } from './copi-timezone.util';
import { isCumulativeSalesQuestion, wantsDetailedSalesList } from './copi-intent-router';
import type { CopiQueryContext, CopiToolName, CopiToolResult } from './copi.types';

interface MessageRow {
  body: string | null;
  created_at: string;
  sender_phone: string | null;
}

interface TaskRow {
  assigned_to_user_id: string | null;
  contact_id: string | null;
  due_at: string | null;
  id: string;
  status: string;
  title: string;
}

interface ConversationRow {
  customer_display_name: string | null;
  external_contact_id: string;
  id: string;
  last_message_at: string | null;
}

interface MemberRow {
  role: 'owner' | 'staff';
  user_id: string;
}

@Injectable()
export class CopiToolRegistry {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly inventoryService: InventoryService,
    private readonly tasksService: TasksService,
  ) {}

  async executeTools(context: CopiQueryContext, tools: CopiToolName[]): Promise<CopiToolResult[]> {
    const results = await Promise.all(
      tools.map(async (tool) => ({
        key: tool,
        ...(await this.executeTool(context, tool)),
      })),
    );

    return results;
  }

  private async executeTool(
    context: CopiQueryContext,
    tool: CopiToolName,
  ): Promise<Omit<CopiToolResult, 'key'>> {
    switch (tool) {
      case 'messages_today':
        return this.messagesToday(context);
      case 'low_stock':
        return this.lowStock(context);
      case 'pending_follow_ups':
      case 'tasks_overview':
        return this.tasksOverview(context);
      case 'sales_summary':
        return this.salesSummary(context);
      case 'sales_today':
        return this.salesForDay(context, 0, 'hoy');
      case 'sales_yesterday':
        return this.salesForDay(context, -1, 'ayer');
      case 'open_conversations':
        return this.openConversations(context);
      case 'pending_ai_drafts':
        return this.pendingAiDrafts(context);
      case 'products_overview':
        return this.productsOverview(context);
      case 'attention_summary':
        return this.attentionSummary(context);
      case 'tasks_due_today':
        return this.tasksDueToday(context);
      case 'tasks_overdue':
        return this.tasksOverdue(context);
      case 'tasks_by_contact':
        return this.tasksByContact(context);
      case 'my_tasks':
        return this.myTasks(context);
      case 'staff_roster':
        return this.staffRoster(context);
      default:
        return { payload: {}, summary: 'Herramienta no disponible.' };
    }
  }

  private async messagesToday(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const timeZone = normalizeTimeZone(context.timezone);
    const { start } = getZonedDayBounds(context.now, timeZone, 0);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversation_messages')
      .select('body, created_at, sender_phone')
      .eq('organization_id', context.organizationId)
      .eq('business_center_id', context.businessCenterId)
      .eq('direction', 'inbound')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to load today's messages for copilot: ${error.message}`);
    }

    const messages = (data ?? []) as MessageRow[];
    return {
      payload: { count: messages.length, messages },
      summary:
        messages.length === 0
          ? 'Mensajes de hoy: todavía no hay mensajes entrantes.'
          : `Mensajes de hoy: ${messages.length} mensaje(s) entrante(s).`,
    };
  }

  private async lowStock(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const products = await this.inventoryService.listLowStockProducts({
      businessCenterId: context.businessCenterId,
      organizationId: context.organizationId,
    });

    return {
      payload: { count: products.length, products },
      summary:
        products.length === 0
          ? 'Stock bajo: no hay productos en umbral de reposición.'
          : `Stock bajo: ${products.length} producto(s) necesitan atención.`,
    };
  }

  private async tasksOverview(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const tasks = await this.tasksService.listTasks({
      businessCenterId: context.businessCenterId,
      organizationId: context.organizationId,
      statuses: ['pending', 'snoozed'],
      limit: 10,
    });

    return {
      payload: { count: tasks.length, tasks },
      summary:
        tasks.length === 0
          ? 'Seguimientos pendientes: no hay tareas pendientes o pospuestas.'
          : `Seguimientos pendientes: ${tasks.length} tarea(s).`,
    };
  }

  private async salesSummary(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const wantsDetail = wantsDetailedSalesList(context.question);
    const cumulative = isCumulativeSalesQuestion(context.question);
    const lookbackDays = cumulative ? 90 : 7;
    const rangeStart = new Date(context.now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const { items, rows, totalCents } = await this.loadSaleMovements(
      context,
      rangeStart,
      context.now,
      wantsDetail || cumulative ? 100 : 50,
    );
    const periodLabel = cumulative ? `últimos ${lookbackDays} días (hasta hoy)` : `${lookbackDays} días`;

    return {
      payload: {
        items,
        period: cumulative ? 'to_date' : '7d',
        saleCount: rows.length,
        salesCents: totalCents,
      },
      summary: this.buildSalesPeriodSummary({
        items,
        periodLabel,
        saleCount: rows.length,
        totalCents,
        wantsDetail: wantsDetail || cumulative,
      }),
    };
  }

  private async salesForDay(
    context: CopiQueryContext,
    dayOffset: number,
    label: 'hoy' | 'ayer',
  ): Promise<Omit<CopiToolResult, 'key'>> {
    const timeZone = normalizeTimeZone(context.timezone);
    const { end, start } = getZonedDayBounds(context.now, timeZone, dayOffset);
    const { items, rows, totalCents } = await this.loadSaleMovements(context, start, end);
    const wantsDetail = wantsDetailedSalesList(context.question);

    return {
      payload: { dayOffset, items, period: label, saleCount: rows.length, salesCents: totalCents },
      summary: this.buildSalesDaySummary({ items, label, saleCount: rows.length, totalCents, wantsDetail }),
    };
  }

  private buildSalesDaySummary(params: {
    items: Array<{
      lineTotalCents: number;
      name: string;
      quantity: number;
      unitPriceCents: number;
    }>;
    label: 'hoy' | 'ayer';
    saleCount: number;
    totalCents: number;
    wantsDetail: boolean;
  }): string {
    return this.buildSalesPeriodSummary({
      items: params.items,
      periodLabel: params.label,
      saleCount: params.saleCount,
      totalCents: params.totalCents,
      wantsDetail: params.wantsDetail,
    });
  }

  private buildSalesPeriodSummary(params: {
    items: Array<{
      lineTotalCents: number;
      name: string;
      quantity: number;
      unitPriceCents: number;
    }>;
    periodLabel: string;
    saleCount: number;
    totalCents: number;
    wantsDetail: boolean;
  }): string {
    if (params.saleCount === 0) {
      return `Ventas (${params.periodLabel}): no hay movimientos registrados.`;
    }

    if (!params.wantsDetail) {
      return `Ventas (${params.periodLabel}): ${params.saleCount} movimiento(s), aprox. $${this.formatCents(params.totalCents)} en valor.`;
    }

    const lines = params.items.map(
      (item, index) =>
        `${index + 1}. ${item.name} — ${item.quantity} u. × $${this.formatCents(item.unitPriceCents)} = $${this.formatCents(item.lineTotalCents)}`,
    );

    return [`Ventas (${params.periodLabel}):`, ...lines, '', `Total: $${this.formatCents(params.totalCents)}`].join(
      '\n',
    );
  }

  private formatCents(cents: number): string {
    return Math.round(cents / 100).toLocaleString('es-AR');
  }

  private async loadSaleMovements(
    context: CopiQueryContext,
    rangeStart: Date,
    rangeEnd: Date,
    limit = 50,
  ): Promise<{
    items: Array<{
      createdAt: string;
      lineTotalCents: number;
      name: string;
      quantity: number;
      unitPriceCents: number;
    }>;
    rows: Array<{
      created_at: string;
      quantity_delta: number;
      products: { name: string; unit_price_cents: number } | { name: string; unit_price_cents: number }[] | null;
    }>;
    totalCents: number;
  }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('inventory_movements')
      .select('quantity_delta, created_at, products(name, unit_price_cents)')
      .eq('organization_id', context.organizationId)
      .eq('business_center_id', context.businessCenterId)
      .eq('movement_type', 'sale')
      .gte('created_at', rangeStart.toISOString())
      .lt('created_at', rangeEnd.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load sales summary: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{
      created_at: string;
      quantity_delta: number;
      products: { name: string; unit_price_cents: number } | { name: string; unit_price_cents: number }[] | null;
    }>;

    let totalCents = 0;
    const items: Array<{
      createdAt: string;
      lineTotalCents: number;
      name: string;
      quantity: number;
      unitPriceCents: number;
    }> = [];

    for (const row of rows) {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      const quantity = Math.abs(Number(row.quantity_delta));
      const unitPriceCents = product?.unit_price_cents ?? 0;
      const lineTotalCents = Math.round(quantity * unitPriceCents);
      totalCents += lineTotalCents;
      items.push({
        createdAt: row.created_at,
        lineTotalCents,
        name: product?.name ?? 'Producto sin nombre',
        quantity,
        unitPriceCents,
      });
    }

    return { items, rows, totalCents };
  }

  private async openConversations(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversations')
      .select('id, external_contact_id, customer_display_name, last_message_at')
      .eq('organization_id', context.organizationId)
      .eq('business_center_id', context.businessCenterId)
      .eq('status', 'open')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(5);

    if (error) {
      throw new Error(`Failed to load open conversations: ${error.message}`);
    }

    const conversations = (data ?? []) as ConversationRow[];
    return {
      payload: { count: conversations.length, conversations },
      summary: `Conversaciones abiertas: ${conversations.length}.`,
    };
  }

  private async pendingAiDrafts(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const client = this.supabaseService.getServiceRoleClient();
    const { count, error } = await client
      .from('ai_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', context.organizationId)
      .eq('business_center_id', context.businessCenterId)
      .eq('status', 'pending_approval');

    if (error) {
      throw new Error(`Failed to load pending AI drafts: ${error.message}`);
    }

    return {
      payload: { count: count ?? 0 },
      summary: `Borradores IA pendientes: ${count ?? 0}.`,
    };
  }

  private async productsOverview(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const client = this.supabaseService.getServiceRoleClient();
    const { count: productCount, error: productError } = await client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', context.organizationId)
      .eq('is_active', true);

    if (productError) {
      throw new Error(`Failed to load products overview: ${productError.message}`);
    }

    const lowStock = await this.inventoryService.listLowStockProducts({
      businessCenterId: context.businessCenterId,
      organizationId: context.organizationId,
    });

    return {
      payload: { activeProducts: productCount ?? 0, lowStockCount: lowStock.length },
      summary: `Catálogo: ${productCount ?? 0} producto(s) activo(s), ${lowStock.length} con stock bajo.`,
    };
  }

  private async attentionSummary(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const [messages, lowStock, tasks, drafts, conversations] = await Promise.all([
      this.messagesToday(context),
      this.lowStock(context),
      this.tasksOverview(context),
      this.pendingAiDrafts(context),
      this.openConversations(context),
    ]);

    return {
      payload: {
        drafts: drafts.payload,
        lowStock: lowStock.payload,
        messages: messages.payload,
        openConversations: conversations.payload,
        tasks: tasks.payload,
      },
      summary: [
        messages.summary,
        lowStock.summary,
        tasks.summary,
        drafts.summary,
        conversations.summary,
      ].join(' '),
    };
  }

  private async tasksDueToday(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const tasks = await this.tasksService.listTasks({
      businessCenterId: context.businessCenterId,
      dueBefore: endOfDay(context.now),
      dueFrom: startOfDay(context.now),
      organizationId: context.organizationId,
      statuses: ['pending', 'snoozed'],
    });

    return {
      payload: { count: tasks.length, tasks },
      summary: `Tareas que vencen hoy: ${tasks.length}.`,
    };
  }

  private async tasksOverdue(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const tasks = await this.tasksService.listTasks({
      businessCenterId: context.businessCenterId,
      dueBefore: context.now.toISOString(),
      organizationId: context.organizationId,
      statuses: ['pending', 'snoozed'],
    });

    return {
      payload: { count: tasks.length, tasks },
      summary: `Tareas atrasadas: ${tasks.length}.`,
    };
  }

  private async tasksByContact(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const contactHint = extractContactHint(context.question);
    const tasks = await this.tasksService.listTasks({
      businessCenterId: context.businessCenterId,
      contactHint,
      organizationId: context.organizationId,
      statuses: ['pending', 'snoozed', 'completed'],
      limit: 10,
    });

    return {
      payload: { contactHint, count: tasks.length, tasks },
      summary:
        contactHint.length > 0
          ? `Tareas relacionadas con "${contactHint}": ${tasks.length}.`
          : `Tareas por contacto: ${tasks.length} (sin filtro de contacto detectado).`,
    };
  }

  private async myTasks(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const tasks = await this.tasksService.listTasks({
      assignedToUserId: context.userId,
      businessCenterId: context.businessCenterId,
      organizationId: context.organizationId,
      statuses: ['pending', 'snoozed'],
    });

    return {
      payload: { count: tasks.length, tasks },
      summary: `Mis tareas asignadas: ${tasks.length}.`,
    };
  }

  private async staffRoster(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', context.organizationId);

    if (error) {
      throw new Error(`Failed to load staff roster: ${error.message}`);
    }

    const members = (data ?? []) as MemberRow[];
    return {
      payload: { count: members.length, members },
      summary: `Equipo: ${members.length} miembro(s) en la organización.`,
    };
  }
}

function startOfDay(date: Date): string {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.toISOString();
}

function endOfDay(date: Date): string {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy.toISOString();
}

function extractContactHint(question: string): string {
  const match = question.match(/\b(?:con|de|para)\s+([a-záéíóúñ0-9+\s]{2,40})/i);
  return match?.[1]?.trim() ?? '';
}
