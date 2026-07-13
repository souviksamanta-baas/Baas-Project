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

  it('routes sales follow-up details using prior sales context', () => {
    expect(
      selectCopiTools(
        'Necesitaria mas detalles. Me gustaria saber cuales son los productos, cuanta cantidad de cada producto se vendió y las ganancias por las ventas',
        [{ body: 'Buenas Tardes! Cuantas ventas hice con productos en granel?', role: 'owner' }],
      ),
    ).toEqual(['sales_summary']);
  });

  it('does not treat lista as attention summary', () => {
    expect(selectCopiTools('Mandame una lista de todo lo que vendí ayer con sus precios y el total')).not.toContain(
      'attention_summary',
    );
  });

  it('routes all suggested Copi questions to the matching tools', () => {
    expect(selectCopiTools('¿Qué necesita mi atención hoy?')).toEqual(['attention_summary']);
    expect(selectCopiTools('¿Cuántas ventas hubo esta semana?')).toEqual(['sales_summary']);
    expect(selectCopiTools('¿Qué productos tienen bajo stock?')).toEqual(['low_stock', 'products_overview']);
    expect(selectCopiTools('¿Qué seguimientos están pendientes?')).toEqual(['tasks_overview']);
    expect(selectCopiTools('¿Cuál es la fecha de vencimiento más cercana?')).toEqual(['expiring_lots']);
    expect(selectCopiTools('¿Cuántas conversaciones abiertas tengo?')).toEqual(['open_conversations']);
  });

  it('routes product expiry questions to expiring_lots, not attention', () => {
    expect(selectCopiTools('Cual es la fecha de vencimiento mas cercano que tengo?')).toEqual(['expiring_lots']);
    expect(selectCopiTools('¿Qué vence hoy?')).toEqual(['expiring_lots']);
    expect(selectCopiTools('¿Qué tareas vencen hoy?')).toEqual(
      expect.arrayContaining(['tasks_overview', 'tasks_due_today']),
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

  it('treats follow-up detail request as detail, not count', () => {
    const history = [
      { body: 'Buenas Tardes! Cuantas ventas hice con productos en granel?', role: 'owner' as const },
    ];
    const followUp =
      'Necesitaria mas detalles. Me gustaria saber cuales son los productos, cuanta cantidad de cada producto se vendió y las ganancias por las ventas';

    expect(wantsDetailedSalesList(followUp, history)).toBe(true);
    expect(wantsSalesCountOnly(followUp, history)).toBe(false);
  });
});

describe('buildGreetingReply', () => {
  it('returns afternoon greeting', () => {
    expect(buildGreetingReply('Hola Copi, Buenas tardes! cuantos ventas hice?')).toBe('¡Buenas tardes!');
  });

  it('greets using the owner first name', () => {
    expect(buildGreetingReply('hola copi', new Date('2026-07-13T15:00:00Z'), 'Souvik Samanta')).toBe(
      '¡Hola, Souvik!',
    );
  });

  it('includes the owner name in time-of-day greetings', () => {
    expect(buildGreetingReply('buenas tardes', new Date(), 'Ana')).toBe('¡Buenas tardes, Ana!');
  });
});
