import { describe, expect, it } from 'vitest';

import { reconcileToolSelection } from '../src/domains/ai/copi-llm-tool-selector.service';

describe('reconcileToolSelection', () => {
  it('keeps specific LLM tools for natural language', () => {
    expect(reconcileToolSelection(['expiring_lots'], [])).toEqual({
      source: 'llm',
      tools: ['expiring_lots'],
    });
  });

  it('falls back to rules when LLM only returns attention_summary', () => {
    expect(reconcileToolSelection(['attention_summary'], ['expiring_lots'])).toEqual({
      source: 'rules',
      tools: ['expiring_lots'],
    });
  });

  it('keeps LLM attention_summary when rules also agree it is attention', () => {
    expect(reconcileToolSelection(['attention_summary'], ['attention_summary'])).toEqual({
      source: 'rules',
      tools: ['attention_summary'],
    });
  });

  it('uses rules when LLM returns no tools', () => {
    expect(reconcileToolSelection([], ['sales_summary'])).toEqual({
      source: 'rules',
      tools: ['sales_summary'],
    });
  });
});
