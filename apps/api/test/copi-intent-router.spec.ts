import { describe, expect, it } from 'vitest';

import {
  buildGreetingReply,
  selectCopiTools,
  wantsDetailedSalesList,
  wantsSalesCountOnly,
} from '../src/domains/ai/copi-intent-router';

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

  it('routes cumulative sales until today as sales_summary', () => {
    expect(selectCopiTools('haceme la lista de todos los productos que vendí hasta hoy')).toEqual([
      'sales_summary',
    ]);
  });

  it('routes Argentine count question about sales as sales_summary', () => {
    expect(
      selectCopiTools('Hola Copi, Buenas tardes! cuantos presupuestos de ventas fue creado hasta hoy?'),
    ).toEqual(['sales_summary']);
  });

  it('does not treat lista as attention summary', () => {
    expect(selectCopiTools('Mandame una lista de todo lo que vendí ayer con sus precios y el total')).not.toContain(
      'attention_summary',
    );
  });
});

describe('wantsDetailedSalesList / wantsSalesCountOnly', () => {
  it('detects list requests with prices and total', () => {
    expect(wantsDetailedSalesList('Mandame una lista de todo lo que vendí ayer con sus precios y el total')).toBe(
      true,
    );
    expect(wantsSalesCountOnly('Mandame una lista de todo lo que vendí ayer con sus precios y el total')).toBe(false);
  });

  it('detects all products sold until today as detail', () => {
    expect(wantsDetailedSalesList('haceme la lista de todos los productos que vendí hasta hoy')).toBe(true);
  });

  it('treats cuantos presupuestos/ventas as count-only', () => {
    expect(
      wantsSalesCountOnly('Hola Copi, Buenas tardes! cuantos presupuestos de ventas fue creado hasta hoy?'),
    ).toBe(true);
    expect(
      wantsDetailedSalesList('Hola Copi, Buenas tardes! cuantos presupuestos de ventas fue creado hasta hoy?'),
    ).toBe(false);
  });
});

describe('buildGreetingReply', () => {
  it('returns afternoon greeting', () => {
    expect(buildGreetingReply('Hola Copi, Buenas tardes! cuantos ventas hice?')).toBe('¡Buenas tardes!');
  });
});
