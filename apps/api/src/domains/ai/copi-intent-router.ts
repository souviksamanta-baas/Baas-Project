import type { CopiToolName } from './copi.types';

const SALES_PATTERN =
  /\b(sale|sales|venta|ventas|factur|ingreso|cobr|ganancia|ganancias|vend(?:i|í|e|é|o|ó|a|á|io|ió|imos|iste|ieron|iendo|ido|ida|idas|idos)?)\b/;
const MESSAGE_PATTERN = /\b(message|messages|chat|chats|inbox|mensaje|mensajes)\b/;
const ATTENTION_PATTERN = /\b(atencion|attention|prioridad|resumen del dia|resumen del dia)\b/;
const CUMULATIVE_SALES_PATTERN =
  /\b(hasta hoy|hasta ahora|todo lo que|todos? los?|todas? las?|historico|historial|acumulad|desde siempre|en total|en general)\b/;
const SALES_DETAIL_PATTERN =
  /\b(lista|listado|detalles?|detallado|desglose|precios?|con precios|item por item|producto por producto|cuales son|que productos|cantidad de cada|mas detalles|mas info|necesitaria|necesito mas|ampliame|mostrame|ganancias por)\b/;
const SALES_COUNT_PATTERN = /\b(cuant[oa]s?|numero)\b/;
const FOLLOW_UP_DETAIL_PATTERN =
  /\b(mas detalles|detalles|mas info|cuales son|que productos|cantidad de cada|necesitaria|necesito mas|amplia|mostrame|de esas|de esos|de eso)\b/;
const GREETING_PATTERN =
  /\b(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|como va|como andas)\b/;

export const COPI_TOOL_CATALOG: Array<{ description: string; name: CopiToolName }> = [
  { description: 'Mensajes entrantes de hoy', name: 'messages_today' },
  { description: 'Productos con stock bajo', name: 'low_stock' },
  { description: 'Seguimientos/tareas pendientes', name: 'pending_follow_ups' },
  {
    description:
      'Ventas acumuladas o de un periodo amplio (semana, hasta hoy, cuántas ventas, historial, follow-ups pidiendo detalle de ventas).',
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

export type CopiConversationTurn = {
  body: string;
  role: 'owner' | 'assistant' | 'system';
};

export function normalizeCopiQuestion(question: string): string {
  return question
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function getPriorOwnerQuestion(history: CopiConversationTurn[] = []): string | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.role === 'owner') {
      return history[index]?.body;
    }
  }

  return undefined;
}

export function buildIntentQuestion(question: string, history: CopiConversationTurn[] = []): string {
  const prior = getPriorOwnerQuestion(history);
  if (!prior) {
    return question;
  }

  return `${question}\n\n(Contexto previo del dueño: ${prior})`;
}

export function selectCopiTools(
  question: string,
  history: CopiConversationTurn[] = [],
): CopiToolName[] {
  const normalized = normalizeCopiQuestion(question);
  const prior = getPriorOwnerQuestion(history);
  const priorNormalized = prior ? normalizeCopiQuestion(prior) : '';
  const tools = new Set<CopiToolName>();
  const priorWasSales = Boolean(prior && isSalesRelatedQuestion(prior));
  const followUpDetail = isSalesFollowUpDetail(question) && priorWasSales;
  const asksSales =
    isSalesRelatedQuestion(question) ||
    followUpDetail ||
    (/\b(lista|detalle|detalles|detallado|productos?|items?|precios?|total)\b/.test(normalized) &&
      /\b(ayer|hoy|semana|hasta)\b/.test(normalized) &&
      /\bvend/.test(normalized));
  const asksMessages = MESSAGE_PATTERN.test(normalized);
  const wantsCumulativeSales =
    CUMULATIVE_SALES_PATTERN.test(normalized) ||
    (followUpDetail && CUMULATIVE_SALES_PATTERN.test(priorNormalized));

  if (asksSales) {
    const periodSource = followUpDetail ? `${priorNormalized} ${normalized}` : normalized;
    if (/\b(ayer|yesterday)\b/.test(periodSource)) {
      tools.add('sales_yesterday');
    } else if (wantsCumulativeSales || /\bhasta\b/.test(periodSource)) {
      tools.add('sales_summary');
    } else if (/\b(hoy|today)\b/.test(periodSource) && !followUpDetail) {
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

export function isSalesRelatedQuestion(question: string): boolean {
  const normalized = normalizeCopiQuestion(question);
  return SALES_PATTERN.test(normalized) || /\bpresupuest/.test(normalized);
}

export function isSalesFollowUpDetail(question: string): boolean {
  return FOLLOW_UP_DETAIL_PATTERN.test(normalizeCopiQuestion(question));
}

export function detectProActionIntent(question: string): boolean {
  const normalized = normalizeCopiQuestion(question);
  return /\b(crea|crear|crea|asign|assign|marca|marcar|complet|cancel|pospon|snooze|recorda|recordar)\b/.test(
    normalized,
  );
}

export function wantsDetailedSalesList(
  question: string,
  history: CopiConversationTurn[] = [],
): boolean {
  const prior = getPriorOwnerQuestion(history);
  if (wantsSalesCountOnly(question, history)) {
    return false;
  }

  const normalized = normalizeCopiQuestion(question);
  if (SALES_DETAIL_PATTERN.test(normalized) || isSalesFollowUpDetail(question)) {
    return true;
  }

  return /\b(lista de (todo|todos|productos)|haceme la lista|mandame la lista)\b/.test(normalized);
}

export function wantsSalesCountOnly(
  question: string,
  history: CopiConversationTurn[] = [],
): boolean {
  const normalized = normalizeCopiQuestion(question);
  if (wantsDetailedSalesListWithoutCountGuard(question) || isSalesFollowUpDetail(question)) {
    return false;
  }

  if (/\bcantidad de cada\b/.test(normalized)) {
    return false;
  }

  // "cuánta cantidad" in a follow-up about products is detail, not "how many sales"
  if (/\bcuant[oa]s?\s+cantidad\b/.test(normalized)) {
    return false;
  }

  return SALES_COUNT_PATTERN.test(normalized);
}

function wantsDetailedSalesListWithoutCountGuard(question: string): boolean {
  const normalized = normalizeCopiQuestion(question);
  return (
    SALES_DETAIL_PATTERN.test(normalized) ||
    /\b(lista de (todo|todos|productos)|haceme la lista|mandame la lista)\b/.test(normalized)
  );
}

export function extractSalesProductFilter(
  question: string,
  history: CopiConversationTurn[] = [],
): string | null {
  const prior = getPriorOwnerQuestion(history);
  const combined = normalizeCopiQuestion(`${prior ?? ''} ${question}`);
  if (/\bgranel\b/.test(combined)) {
    return 'granel';
  }

  return null;
}

export function hasGreeting(question: string): boolean {
  return GREETING_PATTERN.test(normalizeCopiQuestion(question));
}

export function buildGreetingReply(question: string, now = new Date()): string | null {
  if (!hasGreeting(question)) {
    return null;
  }

  const normalized = normalizeCopiQuestion(question);
  if (/\bbuenas noches\b/.test(normalized)) {
    return '¡Buenas noches!';
  }
  if (/\bbuenas tardes\b/.test(normalized)) {
    return '¡Buenas tardes!';
  }
  if (/\b(buen dia|buenos dias)\b/.test(normalized)) {
    return '¡Buen día!';
  }
  if (/\bhola\b/.test(normalized)) {
    const hour = now.getHours();
    if (hour >= 20 || hour < 5) {
      return '¡Hola! Buenas noches.';
    }
    if (hour >= 13) {
      return '¡Hola! Buenas tardes.';
    }
    return '¡Hola! Buen día.';
  }

  return '¡Hola!';
}

export function isCumulativeSalesQuestion(
  question: string,
  history: CopiConversationTurn[] = [],
): boolean {
  const prior = getPriorOwnerQuestion(history);
  const combined = normalizeCopiQuestion(`${prior ?? ''} ${question}`);
  return CUMULATIVE_SALES_PATTERN.test(combined);
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
