import { describe, expect, it } from 'vitest';

import { buildCopiSystemPrompt } from '../src/domains/ai/prompts/copi-prompt-composer';

describe('buildCopiSystemPrompt', () => {
  it('includes all three layers for the phraser', () => {
    const prompt = buildCopiSystemPrompt('phraser');
    expect(prompt).toContain('You are Copi');
    expect(prompt).toContain('Live modules Copi can use today');
    expect(prompt).toContain('sales_summary');
    expect(prompt).toContain('CURRENT TASK');
    expect(prompt).toContain('final answer');
  });

  it('asks the router for JSON only', () => {
    const prompt = buildCopiSystemPrompt('router');
    expect(prompt).toContain('Return ONLY JSON');
    expect(prompt).not.toContain('final answer the owner will read');
  });
});
