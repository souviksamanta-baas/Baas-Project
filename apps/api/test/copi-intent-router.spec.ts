import { describe, expect, it } from 'vitest';

import { selectCopiTools, wantsDetailedSalesList } from '../src/domains/ai/copi-intent-router';

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

  it('routes detailed yesterday sales list with accented vendí', () => {
    expect(
      selectCopiTools('Mandame una lista de todo lo que vendí ayer con sus precios y el total'),
    ).toEqual(['sales_yesterday']);
  });

  it('does not treat lista as attention summary', () => {
    expect(selectCopiTools('Mandame una lista de todo lo que vendí ayer con sus precios y el total')).not.toContain(
      'attention_summary',
    );
  });
});

describe('wantsDetailedSalesList', () => {
  it('detects list requests with prices and total', () => {
    expect(wantsDetailedSalesList('Mandame una lista de todo lo que vendí ayer con sus precios y el total')).toBe(
      true,
    );
  });
});
