import { describe, expect, it } from 'vitest';

import { resolveCopiModel } from '../src/domains/ai/copi-model';
import { parseCopiTurnPlan } from '../src/domains/ai/copi-llm-turn-planner.service';
import { buildCopiSystemPrompt } from '../src/domains/ai/prompts/copi-prompt-composer';
import { inferCopiActionType } from '../src/domains/ai/copi-action.service';

describe('resolveCopiModel', () => {
  it('maps planner to gpt-4o and phrasing roles to mini', () => {
    expect(resolveCopiModel('planner')).toBe('gpt-4o');
    expect(resolveCopiModel('phrase')).toBe('gpt-4o-mini');
    expect(resolveCopiModel('whatsapp_draft')).toBe('gpt-4o-mini');
    expect(resolveCopiModel('vision')).toBe('gpt-4o-mini');
    expect(resolveCopiModel('router')).toBe('gpt-4o-mini');
  });
});

describe('buildCopiSystemPrompt(planner)', () => {
  it('includes turn-planner schema and Frutigran-class guidance', () => {
    const prompt = buildCopiSystemPrompt('planner');
    expect(prompt).toContain('TURN PLANNER');
    expect(prompt).toContain('revise_customer_reply');
    expect(prompt).toContain('confirm_pending');
    expect(prompt).toContain('NEVER create_task');
  });
});

describe('parseCopiTurnPlan', () => {
  it('parses a stock answer plan', () => {
    const plan = parseCopiTurnPlan(
      JSON.stringify({
        kind: 'answer',
        tools: ['find_product', 'low_stock'],
        toolArgs: { find_product: { query: 'galletitas Frutigran' } },
        action: null,
        confirmTarget: 'none',
        ownerNotes: 'Responder con stock real',
      }),
    );
    expect(plan?.kind).toBe('answer');
    expect(plan?.tools).toEqual(['find_product', 'low_stock']);
    expect(plan?.toolArgs.find_product).toEqual({ query: 'galletitas Frutigran' });
    expect(plan?.ownerNotes).toBe('Responder con stock real');
  });

  it('parses Frutigran-style revise_customer_reply (not create_task)', () => {
    const plan = parseCopiTurnPlan(`\`\`\`json
{
  "kind": "revise_customer_reply",
  "tools": ["conversation_thread", "find_product"],
  "toolArgs": { "find_product": { "query": "Frutigran" } },
  "action": { "type": "propose_customer_reply", "payload": {} },
  "confirmTarget": "none",
  "ownerNotes": "Reformular respuesta al cliente"
}
\`\`\``);
    expect(plan?.kind).toBe('revise_customer_reply');
    expect(plan?.action?.type).toBe('propose_customer_reply');
    expect(plan?.tools).toContain('conversation_thread');
  });

  it('parses mixed sí al mensaje confirm', () => {
    const plan = parseCopiTurnPlan(
      JSON.stringify({
        kind: 'confirm_pending',
        tools: [],
        toolArgs: {},
        action: null,
        confirmTarget: 'customer_reply',
        ownerNotes: null,
      }),
    );
    expect(plan?.kind).toBe('confirm_pending');
    expect(plan?.confirmTarget).toBe('customer_reply');
  });

  it('parses reject_pending', () => {
    const plan = parseCopiTurnPlan(
      JSON.stringify({
        kind: 'reject_pending',
        tools: [],
        confirmTarget: 'latest_pending',
      }),
    );
    expect(plan?.kind).toBe('reject_pending');
    expect(plan?.confirmTarget).toBe('latest_pending');
  });

  it('drops unknown tools and invalid kinds', () => {
    expect(
      parseCopiTurnPlan(
        JSON.stringify({
          kind: 'hack_db',
          tools: ['find_product', 'run_sql'],
        }),
      ),
    ).toBeNull();

    const plan = parseCopiTurnPlan(
      JSON.stringify({
        kind: 'answer',
        tools: ['find_product', 'run_sql', 'attention_summary'],
      }),
    );
    expect(plan?.tools).toEqual(['find_product', 'attention_summary']);
  });
});

describe('golden Spanish intent fallbacks (regex demoted)', () => {
  it('does not invent create_task when owner rejects task and asks to reply', () => {
    const question =
      'No es una tarea. Deberíamos responder al cliente y agregá en la respuesta que las Frutigran están en stock';
    expect(inferCopiActionType(question)).toBe('propose_customer_reply');
  });

  it('maps explicit WhatsApp reply ask to propose_customer_reply', () => {
    expect(
      inferCopiActionType('Respondé al cliente por WhatsApp que tenemos stock de Frutigran'),
    ).toBe('propose_customer_reply');
  });
});
