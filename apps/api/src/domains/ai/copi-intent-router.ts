import type { CopiToolName } from './copi.types';

const SALES_PATTERN =
  /\b(sale|sales|venta|ventas|factur|ingreso|cobr|vend(?:i|í|e|é|o|ó|a|á|imos|iste|ieron|iendo|ido|ida|idas|idos)?)\b/;
const MESSAGE_PATTERN = /\b(message|messages|chat|chats|inbox|mensaje|mensajes)\b/;
const ATTENTION_PATTERN = /\b(atencion|attention|prioridad|resumen del dia|resumen del dia)\b/;
const CUMULATIVE_SALES_PATTERN =
  /\b(hasta hoy|hasta ahora|todo lo que|todos? los?|todas? las?|historico|historial|acumulad|desde siempre|en total|en general)\b/;

export const COPI_TOOL_CATALOG: Array<{ description: string; name: CopiToolName }> = [
  { description: 'Mensajes entrantes de hoy', name: 'messages_today' },
  { description: 'Productos con stock bajo', name: 'low_stock' },
  { description: 'Seguimientos/tareas pendientes', name: 'pending_follow_ups' },
  {
    description:
      'Ventas acumuladas o de un periodo amplio (semana, hasta hoy, todos los productos vendidos, historial)',
    name: 'sales_summary',
  },
  { description: 'Ventas solo de hoy (el día de hoy)', name: 'sales_today' },
  { description: 'Ventas solo de ayer', name: 'sales_yesterday' },
  { description: 'Conversaciones abiertas', name: 'open_conversations' },
  { description: 'Borradores de IA pendientes', name: 'pending_ai_drafts' },
  { description: 'Resumen del catálogo de productos', name: 'products_overview' },
  { description: 'Resumen general de atención del día', name: 'attention_summary' },
  { description: 'Listado de tareas/seguimientos', name: 'tasks_overview' },
  { description: 'Tareas que vencen hoy', name: 'tasks_due_today' },
  { description: 'Tareas atrasadas', name: 'tasks_overdue' },
  { description: 'Tareas filtradas por contacto/cliente', name: 'tasks_by_contact' },
  { description: 'Mis tareas asignadas', name: 'my_tasks' },
  { description: 'Integrantes del equipo', name: 'staff_roster' },
];

export function normalizeCopiQuestion(question: string): string {
  return question
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function selectCopiTools(question: string): CopiToolName[] {
  const normalized = normalizeCopiQuestion(question);
  const tools = new Set<CopiToolName>();
  const asksSales =
    SALES_PATTERN.test(normalized) ||
    (/\b(lista|detalle|detallado|productos?|items?|precios?|total)\b/.test(normalized) &&
      /\b(ayer|hoy|semana|hasta)\b/.test(normalized) &&
      /\bvend/.test(normalized));
  const asksMessages = MESSAGE_PATTERN.test(normalized);
  const wantsCumulativeSales = CUMULATIVE_SALES_PATTERN.test(normalized);

  if (asksSales) {
    if (/\b(ayer|yesterday)\b/.test(normalized)) {
      tools.add('sales_yesterday');
    } else if (wantsCumulativeSales || /\bhasta\b/.test(normalized)) {
      tools.add('sales_summary');
    } else if (/\b(hoy|today)\b/.test(normalized)) {
      tools.add('sales_today');
    } else {
      tools.add('sales_summary');
    }
  }

  if (asksMessages || (/\b(hoy|today)\b/.test(normalized) && !asksSales)) {
    if (/\b(hoy|today)\b/.test(normalized) || asksMessages) {
      tools.add('messages_today');
    }
  }

  if (/\b(low stock|stock|inventory|reorder|bajo stock|inventario)\b/.test(normalized)) {
    tools.add('low_stock');
    tools.add('products_overview');
  }

  if (/\b(conversation|conversacion|conversaciones|abiert)\b/.test(normalized)) {
    tools.add('open_conversations');
  }

  if (/\b(draft|borrador|borradores|ai draft)\b/.test(normalized)) {
    tools.add('pending_ai_drafts');
  }

  if (ATTENTION_PATTERN.test(normalized)) {
    tools.add('attention_summary');
  }

  if (/\b(task|tasks|follow|follow-up|followup|seguimiento|seguimientos|tarea|tareas|pendiente)\b/.test(normalized)) {
    tools.add('tasks_overview');
  }

  if (/\b(vence hoy|due today|hoy vence)\b/.test(normalized)) {
    tools.add('tasks_due_today');
  }

  if (/\b(atrasad|overdue|vencid)\b/.test(normalized)) {
    tools.add('tasks_overdue');
  }

  if (/\b(asignad|my task|mis tarea)\b/.test(normalized)) {
    tools.add('my_tasks');
  }

  if (/\b(staff|equipo|emplead|asignar a)\b/.test(normalized)) {
    tools.add('staff_roster');
  }

  if (/\b(contact|cliente|clienta|contacto)\b/.test(normalized)) {
    tools.add('tasks_by_contact');
  }

  if (tools.size === 0) {
    return ['attention_summary'];
  }

  return Array.from(tools);
}

export function detectProActionIntent(question: string): boolean {
  const normalized = normalizeCopiQuestion(question);
  return /\b(crea|crear|crea|asign|assign|marca|marcar|complet|cancel|pospon|snooze|recorda|recordar)\b/.test(
    normalized,
  );
}

export function wantsDetailedSalesList(question: string): boolean {
  const normalized = normalizeCopiQuestion(question);
  return /\b(lista|detalle|detallado|productos?|items?|precios?|total|todo lo que|todos? los?)\b/.test(
    normalized,
  );
}

export function isCumulativeSalesQuestion(question: string): boolean {
  const normalized = normalizeCopiQuestion(question);
  return CUMULATIVE_SALES_PATTERN.test(normalized);
}

export function sanitizeSelectedTools(tools: unknown): CopiToolName[] {
  const allowed = new Set(COPI_TOOL_CATALOG.map((tool) => tool.name));
  if (!Array.isArray(tools)) {
    return [];
  }

  const unique = new Set<CopiToolName>();
  for (const tool of tools) {
    if (typeof tool === 'string' && allowed.has(tool as CopiToolName)) {
      unique.add(tool as CopiToolName);
    }
  }

  return Array.from(unique);
}
