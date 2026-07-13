import { Injectable } from '@nestjs/common';

import { InventoryService } from '../inventory/inventory.service';
import { TasksService } from '../tasks/tasks.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { getZonedDayBounds, normalizeTimeZone } from './copi-timezone.util';
import {
  extractSalesProductFilter,
  isCumulativeSalesQuestion,
  wantsDetailedSalesList,
  wantsSalesCountOnly,
} from './copi-intent-router';
import { formatCopiProductLink } from './copi-product-link.util';
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
      case 'expiring_lots':
        return this.expiringLots(context);
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

    const listed = products.map((product) => ({
      id: product.id,
      name: product.name,
      quantityOnHand: product.stockQuantity,
      reorderThreshold: product.reorderThreshold,
      unitCode: product.unitCode,
    }));

    const productLines = listed
      .map(
        (product) =>
          `${formatCopiProductLink(product.id, product.name)} (${product.quantityOnHand} ${product.unitCode}, mínimo ${product.reorderThreshold})`,
      )
      .join('; ');

    return {
      payload: { count: listed.length, products: listed },
      summary:
        listed.length === 0
          ? 'Stock bajo: no hay productos en umbral de reposición.'
          : `Stock bajo: ${listed.length} producto(s) necesitan atención: ${productLines}.`,
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
    const history = context.conversationHistory ?? [];
    const wantsDetail = wantsDetailedSalesList(context.question, history);
    const wantsCount = wantsSalesCountOnly(context.question, history);
    const cumulative = isCumulativeSalesQuestion(context.question, history);
    const productFilter = extractSalesProductFilter(context.question, history);
    const lookbackDays = cumulative ? 90 : 7;
    const rangeStart = new Date(context.now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const loaded = await this.loadSaleMovements(context, rangeStart, context.now, wantsDetail ? 100 : 50);
    const filtered = this.filterSaleItems(loaded, productFilter);
    const periodLabel = cumulative ? `últimos ${lookbackDays} días (hasta hoy)` : `${lookbackDays} días`;
    const filterLabel = productFilter ? ` filtradas por "${productFilter}"` : '';

    return {
      payload: {
        filter: productFilter,
        items: wantsDetail ? filtered.items : [],
        period: cumulative ? 'to_date' : '7d',
        responseMode: wantsDetail ? 'detail' : wantsCount ? 'count' : 'summary',
        saleCount: filtered.items.length,
        salesCents: filtered.totalCents,
      },
      summary: this.buildSalesPeriodSummary({
        items: filtered.items,
        periodLabel: `${periodLabel}${filterLabel}`,
        saleCount: filtered.items.length,
        totalCents: filtered.totalCents,
        wantsCount,
        wantsDetail,
      }),
    };
  }

  private async salesForDay(
    context: CopiQueryContext,
    dayOffset: number,
    label: 'hoy' | 'ayer',
  ): Promise<Omit<CopiToolResult, 'key'>> {
    const history = context.conversationHistory ?? [];
    const timeZone = normalizeTimeZone(context.timezone);
    const { end, start } = getZonedDayBounds(context.now, timeZone, dayOffset);
    const loaded = await this.loadSaleMovements(context, start, end);
    const productFilter = extractSalesProductFilter(context.question, history);
    const filtered = this.filterSaleItems(loaded, productFilter);
    const wantsDetail = wantsDetailedSalesList(context.question, history);
    const wantsCount = wantsSalesCountOnly(context.question, history);
    const filterLabel = productFilter ? ` filtradas por "${productFilter}"` : '';

    return {
      payload: {
        dayOffset,
        filter: productFilter,
        items: wantsDetail ? filtered.items : [],
        period: label,
        responseMode: wantsDetail ? 'detail' : wantsCount ? 'count' : 'summary',
        saleCount: filtered.items.length,
        salesCents: filtered.totalCents,
      },
      summary: this.buildSalesPeriodSummary({
        items: filtered.items,
        periodLabel: `${label}${filterLabel}`,
        saleCount: filtered.items.length,
        totalCents: filtered.totalCents,
        wantsCount,
        wantsDetail,
      }),
    };
  }

  private filterSaleItems(
    loaded: {
      items: Array<{
        createdAt: string;
        lineTotalCents: number;
        name: string;
        productId: string | null;
        quantity: number;
        unitPriceCents: number;
      }>;
      rows: unknown[];
      totalCents: number;
    },
    productFilter: string | null,
  ): {
    items: Array<{
      createdAt: string;
      lineTotalCents: number;
      name: string;
      productId: string | null;
      quantity: number;
      unitPriceCents: number;
    }>;
    totalCents: number;
  } {
    if (!productFilter) {
      return { items: loaded.items, totalCents: loaded.totalCents };
    }

    const needle = productFilter.toLocaleLowerCase();
    const items = loaded.items.filter((item) => item.name.toLocaleLowerCase().includes(needle));
    const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    return { items, totalCents };
  }

  private buildSalesPeriodSummary(params: {
    items: Array<{
      lineTotalCents: number;
      name: string;
      productId: string | null;
      quantity: number;
      unitPriceCents: number;
    }>;
    periodLabel: string;
    saleCount: number;
    totalCents: number;
    wantsCount: boolean;
    wantsDetail: boolean;
  }): string {
    if (params.saleCount === 0) {
      return `Ventas (${params.periodLabel}): no hay movimientos registrados.`;
    }

    if (params.wantsDetail) {
      const lines = params.items.map((item, index) => {
        const label = item.productId
          ? formatCopiProductLink(item.productId, item.name)
          : item.name;
        return `${index + 1}. ${label} — ${item.quantity} u. × $${this.formatCents(item.unitPriceCents)} = $${this.formatCents(item.lineTotalCents)}`;
      });

      return [`Ventas (${params.periodLabel}):`, ...lines, '', `Total: $${this.formatCents(params.totalCents)}`].join(
        '\n',
      );
    }

    if (params.wantsCount) {
      return `Hasta ahora hay ${params.saleCount} venta(s) registrada(s) (${params.periodLabel}), por un total aproximado de $${this.formatCents(params.totalCents)}.`;
    }

    return `Ventas (${params.periodLabel}): ${params.saleCount} venta(s), aprox. $${this.formatCents(params.totalCents)} en valor.`;
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
      productId: string | null;
      quantity: number;
      unitPriceCents: number;
    }>;
    rows: Array<{
      created_at: string;
      quantity_delta: number;
      products:
        | { id: string; name: string; unit_price_cents: number }
        | { id: string; name: string; unit_price_cents: number }[]
        | null;
    }>;
    totalCents: number;
  }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('inventory_movements')
      .select('quantity_delta, created_at, products(id, name, unit_price_cents)')
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
      products:
        | { id: string; name: string; unit_price_cents: number }
        | { id: string; name: string; unit_price_cents: number }[]
        | null;
    }>;

    let totalCents = 0;
    const items: Array<{
      createdAt: string;
      lineTotalCents: number;
      name: string;
      productId: string | null;
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
        productId: product?.id ?? null,
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

  private async expiringLots(context: CopiQueryContext): Promise<Omit<CopiToolResult, 'key'>> {
    const timeZone = normalizeTimeZone(context.timezone);
    const { end: todayEnd, start: todayStart } = getZonedDayBounds(context.now, timeZone, 0);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('inventory_lots')
      .select(
        'id, lot_code, remaining_quantity, unit_code, expires_at, products(id, name)',
      )
      .eq('organization_id', context.organizationId)
      .eq('business_center_id', context.businessCenterId)
      .gt('remaining_quantity', 0)
      .not('expires_at', 'is', null)
      .order('expires_at', { ascending: true })
      .limit(20);

    if (error) {
      throw new Error(`Failed to load expiring lots for copilot: ${error.message}`);
    }

    type LotRow = {
      expires_at: string;
      id: string;
      lot_code: string | null;
      products: { id: string; name: string } | { id: string; name: string }[] | null;
      remaining_quantity: number;
      unit_code: string;
    };

    const lots = ((data ?? []) as LotRow[]).map((row) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        expiresAt: row.expires_at,
        id: row.id,
        lotCode: row.lot_code,
        productId: product?.id ?? null,
        productName: product?.name ?? 'Producto',
        remainingQuantity: Number(row.remaining_quantity),
        unitCode: row.unit_code,
      };
    });

    const normalized = context.question
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    const wantsTodayOnly =
      /\b(vence hoy|vencen hoy|hoy vence|hoy vencen)\b/.test(normalized) &&
      !/\b(mas cercan|proxima|proximo|proximos|proximas)\b/.test(normalized);

    const filtered = wantsTodayOnly
      ? lots.filter((lot) => {
          const expiresAt = new Date(lot.expiresAt).getTime();
          return expiresAt >= todayStart.getTime() && expiresAt < todayEnd.getTime();
        })
      : lots;

    if (filtered.length === 0) {
      return {
        payload: { count: 0, lots: [], mode: wantsTodayOnly ? 'today' : 'nearest' },
        summary: wantsTodayOnly
          ? 'Vencimientos de hoy: no hay lotes con stock que venzan hoy.'
          : 'Vencimientos: no hay lotes con stock y fecha de vencimiento cargada.',
      };
    }

    const nearest = filtered[0];
    const nearestLabel = formatDateEsAr(nearest.expiresAt, timeZone);
    const linkedName = (lot: (typeof filtered)[number]): string =>
      lot.productId ? formatCopiProductLink(lot.productId, lot.productName) : lot.productName;
    const formatLotLine = (lot: (typeof filtered)[number]): string =>
      `${linkedName(lot)} (${formatDateEsAr(lot.expiresAt, timeZone)}, ${lot.remainingQuantity} ${lot.unitCode})`;
    const todayPreview = filtered.slice(0, 5).map(formatLotLine).join('; ');
    const upcomingPreview = filtered.slice(1, 6).map(formatLotLine).join('; ');

    return {
      payload: {
        count: filtered.length,
        lots: filtered.slice(0, 10),
        mode: wantsTodayOnly ? 'today' : 'nearest',
        nearest: nearest,
      },
      summary: wantsTodayOnly
        ? `Vencimientos de hoy: ${filtered.length}. ${todayPreview}.`
        : `Fecha de vencimiento más cercana: ${nearestLabel} — ${linkedName(nearest)}` +
          (nearest.lotCode ? ` (lote ${nearest.lotCode})` : '') +
          `, ${nearest.remainingQuantity} ${nearest.unitCode}.` +
          (upcomingPreview ? ` Próximos: ${upcomingPreview}.` : ''),
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

function formatDateEsAr(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).format(new Date(iso));
}
