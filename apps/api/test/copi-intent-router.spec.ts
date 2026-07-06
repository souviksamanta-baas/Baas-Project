import { describe, expect, it } from 'vitest';

import { selectCopiTools } from '../src/domains/ai/copi-intent-router';

describe('selectCopiTools', () => {
  it('routes today sales without pulling messages_today', () => {
    expect(selectCopiTools('cuanta venta hice hoy?')).toEqual(['sales_today']);
  });

  it('routes yesterday sales', () => {
    expect(selectCopiTools('cuanta venta hice ayer?')).toEqual(['sales_yesterday']);
  });

  it('routes weekly sales by default', () => {
    expect(selectCopiTools('cuanto vendi esta semana?')).toEqual(['sales_summary']);
  });

  it('routes message questions for today', () => {
    expect(selectCopiTools('cuantos mensajes hoy?')).toEqual(['messages_today']);
  });
});
