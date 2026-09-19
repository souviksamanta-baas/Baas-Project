import type { CopiActionType, CopiToolName } from './copi.types';

/** Full org `feature_flags` map (product modules + Copi toggles). */
export type OrganizationFeatureFlagMap = Record<string, boolean>;

const TOOL_FLAG_REQUIREMENTS: Partial<Record<CopiToolName, string>> = {
  analyze_presupuesto: 'billing_quotes',
  appointments_today: 'appointments',
  appointments_upcoming: 'appointments',
  cash_day: 'billing_cash',
  cash_report: 'billing_cash',
  conversation_thread: 'inbox',
  expiring_lots: 'commerce_lots',
  find_product: 'commerce_inventory',
  list_presupuestos: 'billing_quotes',
  low_stock: 'commerce_inventory',
  messages_today: 'inbox',
  open_conversations: 'inbox',
  pending_ai_drafts: 'inbox',
  products_overview: 'commerce_inventory',
  sales_summary: 'commerce_inventory',
  sales_today: 'commerce_inventory',
  sales_yesterday: 'commerce_inventory',
  staff_roster: 'account',
  tasks_by_contact: 'tasks',
  tasks_due_today: 'tasks',
  tasks_overdue: 'tasks',
  tasks_overview: 'tasks',
  my_tasks: 'tasks',
  pending_follow_ups: 'tasks',
};

const ACTION_FLAG_REQUIREMENTS: Partial<Record<CopiActionType, string>> = {
  add_stock: 'commerce_inventory',
  appointment_assign: 'appointments',
  appointment_create: 'appointments',
  appointment_update: 'appointments',
  assign_conversation_to_copi: 'inbox',
  cash_egreso: 'billing_cash',
  cash_ingreso: 'billing_cash',
  create_presupuesto: 'billing_quotes',
  create_product: 'commerce_inventory',
  propose_customer_reply: 'inbox',
};

const CAPABILITY_DESCRIPTIONS: Array<{
  flag: string;
  label: string;
  customerFacingHint: string;
}> = [
  {
    flag: 'commerce_inventory',
    label: 'Inventario y productos',
    customerFacingHint:
      'Podés consultar stock/precios y ofrecer productos reales del catálogo.',
  },
  {
    flag: 'commerce_lots',
    label: 'Lotes y vencimientos',
    customerFacingHint: 'Podés hablar de vencimientos cuando haya datos de lotes.',
  },
  {
    flag: 'commerce_pos',
    label: 'Punto de venta',
    customerFacingHint: 'El negocio registra ventas en Nexolia.',
  },
  {
    flag: 'billing_quotes',
    label: 'Presupuestos',
    customerFacingHint:
      'Podés ofrecer armar o enviar un presupuesto (el dueño confirma en Copi).',
  },
  {
    flag: 'billing_cash',
    label: 'Caja',
    customerFacingHint: 'El negocio gestiona caja en Nexolia (no inventes saldos).',
  },
  {
    flag: 'appointments',
    label: 'Agenda / turnos',
    customerFacingHint:
      'Podés ofrecer turnos, degustaciones o citas y pedir día/horario (el dueño confirma el alta en agenda).',
  },
  {
    flag: 'tasks',
    label: 'Tareas y seguimientos',
    customerFacingHint:
      'El dueño puede crear seguimientos internos; no digas que ya se creó una tarea al cliente.',
  },
  {
    flag: 'inbox',
    label: 'WhatsApp / chats',
    customerFacingHint: 'Estás respondiendo en el hilo de WhatsApp del negocio.',
  },
  {
    flag: 'integrations_whatsapp',
    label: 'WhatsApp conectado',
    customerFacingHint: 'El canal activo es WhatsApp.',
  },
  {
    flag: 'billing_invoices',
    label: 'Facturación (app)',
    customerFacingHint:
      'Hay facturación en Nexolia, pero Copi todavía no emite facturas AFIP/ARCA: no prometas factura fiscal automática.',
  },
  {
    flag: 'billing_arca',
    label: 'ARCA / AFIP (app)',
    customerFacingHint:
      'No digas que podés emitir Factura A/B/C desde este chat; ofrecé alternativa real (presupuesto, turno, stock).',
  },
];

export function isOrgFlagEnabled(
  flags: OrganizationFeatureFlagMap,
  flag: string,
): boolean {
  return flags[flag] === true;
}

export function filterToolsByOrgFlags(
  tools: CopiToolName[],
  flags: OrganizationFeatureFlagMap,
): CopiToolName[] {
  return tools.filter((tool) => {
    const required = TOOL_FLAG_REQUIREMENTS[tool];
    if (!required) {
      return true;
    }
    return isOrgFlagEnabled(flags, required);
  });
}

export function filterActionsByOrgFlags(
  actions: CopiActionType[],
  flags: OrganizationFeatureFlagMap,
): CopiActionType[] {
  return actions.filter((action) => {
    const required = ACTION_FLAG_REQUIREMENTS[action];
    if (!required) {
      return true;
    }
    return isOrgFlagEnabled(flags, required);
  });
}

export function listEnabledCustomerCapabilities(
  flags: OrganizationFeatureFlagMap,
): Array<{ flag: string; label: string; customerFacingHint: string }> {
  return CAPABILITY_DESCRIPTIONS.filter((item) => isOrgFlagEnabled(flags, item.flag));
}

export function buildCustomerReplyCapabilitiesPrompt(
  flags: OrganizationFeatureFlagMap,
): string {
  const enabled = listEnabledCustomerCapabilities(flags);
  if (enabled.length === 0) {
    return [
      'Capacidades habilitadas para este negocio: ninguna módulo operativo marcado.',
      'No inventes funciones. Pedí aclaración amable si hace falta.',
    ].join('\n');
  }

  const lines = enabled.map(
    (item) => `- ${item.label} (${item.flag}): ${item.customerFacingHint}`,
  );

  return [
    'Capacidades HABILITADAS en este negocio (feature flags). Tratalas como disponibles:',
    ...lines,
    'Nunca digas que el negocio “no tiene” / “no gestiona” algo que esté en esta lista.',
    'Si el cliente pide algo habilitado, avanzá el pedido (ofrecé, pedí datos faltantes, confirmá el siguiente paso).',
    'No inventes stock, precios, horarios libres ni ids. Usá toolResults cuando existan.',
    'No digas que ya creaste un turno, presupuesto o tarea: eso lo confirma el dueño en Copi.',
  ].join('\n');
}
