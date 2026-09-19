import { describe, expect, it } from 'vitest';

import {
  applyCustomerReplyGreeting,
  buildCustomerOutboundGreeting,
  hasOutboundWithinLastSixHours,
  stripLeadingCustomerGreeting,
  timeOfDayGreeting,
} from '../src/domains/ai/copi-customer-greeting';

describe('copi-customer-greeting', () => {
  it('detects outbound within the last 6 hours', () => {
    const now = new Date('2026-09-18T18:00:00.000Z');
    expect(
      hasOutboundWithinLastSixHours({
        now,
        outboundCreatedAts: ['2026-09-18T15:00:00.000Z'],
      }),
    ).toBe(true);
    expect(
      hasOutboundWithinLastSixHours({
        now,
        outboundCreatedAts: ['2026-09-18T10:00:00.000Z'],
      }),
    ).toBe(false);
  });

  it('builds personalized TOD greeting in Argentina timezone', () => {
    // 08:00 Argentina (UTC-3) on a normal day
    const morning = new Date('2026-09-18T11:00:00.000Z');
    expect(
      buildCustomerOutboundGreeting({
        customerDisplayName: 'Sandra López',
        now: morning,
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    ).toBe('Hola Sandra. Buenos días.');

    const night = new Date('2026-09-19T01:00:00.000Z');
    expect(timeOfDayGreeting(night, 'America/Argentina/Buenos_Aires')).toBe('Buenas noches');
  });

  it('prepends greeting only for the first reply in 6h and strips LLM greetings on follow-ups', () => {
    const now = new Date('2026-09-18T18:00:00.000Z');
    const first = applyCustomerReplyGreeting({
      body: '¡Hola! Tenemos stock de Frutigran.',
      customerDisplayName: 'Sandra',
      now,
      outboundCreatedAts: [],
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    expect(first.startsWith('Hola Sandra.')).toBe(true);
    expect(first).toContain('Tenemos stock de Frutigran.');
    expect(first.match(/Hola/gi)?.length).toBe(1);

    const followUp = applyCustomerReplyGreeting({
      body: 'Hola Sandra, también te dejo el precio.',
      customerDisplayName: 'Sandra',
      now,
      outboundCreatedAts: ['2026-09-18T16:00:00.000Z'],
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    expect(followUp).toBe('también te dejo el precio.');
    expect(followUp.toLowerCase().startsWith('hola')).toBe(false);
  });

  it('strips stacked leading greetings', () => {
    expect(stripLeadingCustomerGreeting('Hola. Buenos días. Tenemos stock.')).toBe(
      'Tenemos stock.',
    );
  });
});
