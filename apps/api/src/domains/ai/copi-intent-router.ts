import type { CopiToolName } from './copi.types';

export function selectCopiTools(question: string): CopiToolName[] {
  const normalized = question.toLocaleLowerCase();
  const tools = new Set<CopiToolName>();

  if (/\b(message|messages|chat|chats|inbox|mensaje|mensajes|hoy)\b/.test(normalized)) {
    tools.add('messages_today');
  }

  if (/\b(low stock|stock|inventory|reorder|bajo stock|inventario)\b/.test(normalized)) {
    tools.add('low_stock');
    tools.add('products_overview');
  }

  if (/\b(sale|sales|venta|ventas|factur|ingreso)\b/.test(normalized)) {
    tools.add('sales_summary');
  }

  if (/\b(conversation|conversacion|conversaciones|abiert)\b/.test(normalized)) {
    tools.add('open_conversations');
  }

  if (/\b(draft|borrador|borradores|ai draft)\b/.test(normalized)) {
    tools.add('pending_ai_drafts');
  }

  if (/\b(atencion|attention|prioridad|resumen|resumen del dia)\b/.test(normalized)) {
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
  const normalized = question.toLocaleLowerCase();
  return /\b(crea|crear|creá|asign|assign|marcá|marca|complet|cancel|pospon|snooze|recordá|recordar)\b/.test(
    normalized,
  );
}
