import { describe, expect, it } from 'vitest';

import {
  buildCustomerReplyCapabilitiesPrompt,
  filterActionsByOrgFlags,
  filterToolsByOrgFlags,
  listEnabledCustomerCapabilities,
} from '../src/domains/ai/copi-org-capabilities';

describe('copi-org-capabilities', () => {
  it('filters tools by org feature flags', () => {
    const tools = filterToolsByOrgFlags(
      [
        'conversation_thread',
        'find_product',
        'appointments_upcoming',
        'cash_day',
        'list_presupuestos',
        'tasks_overview',
      ],
      {
        appointments: true,
        billing_cash: false,
        billing_quotes: true,
        commerce_inventory: true,
        inbox: true,
        tasks: false,
      },
    );

    expect(tools).toEqual([
      'conversation_thread',
      'find_product',
      'appointments_upcoming',
      'list_presupuestos',
    ]);
  });

  it('filters actions by org feature flags', () => {
    const actions = filterActionsByOrgFlags(
      ['propose_customer_reply', 'appointment_create', 'cash_ingreso', 'create_presupuesto'],
      {
        appointments: true,
        billing_cash: false,
        billing_quotes: true,
        inbox: true,
      },
    );

    expect(actions).toEqual([
      'propose_customer_reply',
      'appointment_create',
      'create_presupuesto',
    ]);
  });

  it('lists enabled customer-facing capabilities and never omits appointments when on', () => {
    const enabled = listEnabledCustomerCapabilities({
      appointments: true,
      commerce_inventory: true,
      inbox: true,
    });
    expect(enabled.map((item) => item.flag)).toContain('appointments');
    expect(enabled.map((item) => item.flag)).toContain('commerce_inventory');

    const prompt = buildCustomerReplyCapabilitiesPrompt({
      appointments: true,
      commerce_inventory: true,
      inbox: true,
    });
    expect(prompt).toMatch(/Agenda \/ turnos/i);
    expect(prompt).toMatch(/Nunca digas que el negocio/);
  });
});
