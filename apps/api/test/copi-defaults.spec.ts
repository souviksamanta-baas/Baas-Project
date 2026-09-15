import { describe, expect, it } from 'vitest';

import {
  advanceByRecurrence,
  buildRecurrenceInstanceSourceKey,
  defaultDueIn24hIso,
  defaultRemindAtFromDue,
  parseCashReportRange,
  softDefaultAssumptionsLine,
  todayYmd,
  truncateLabel,
} from '../src/domains/ai/copi-defaults';

describe('copi-defaults', () => {
  it('advances weekly to a target weekday', () => {
    // 2026-09-14 is Monday (1). Next Friday (5) from that instant.
    const fromMonday = '2026-09-14T12:00:00.000Z';
    expect(
      advanceByRecurrence({ fromIso: fromMonday, freq: 'weekly', weekday: 5 }),
    ).toBe('2026-09-18T12:00:00.000Z');
  });

  it('advances daily and monthly recurrence', () => {
    expect(
      advanceByRecurrence({ fromIso: '2026-09-14T12:00:00.000Z', freq: 'daily' }),
    ).toBe('2026-09-15T12:00:00.000Z');
    expect(
      advanceByRecurrence({ fromIso: '2026-09-14T12:00:00.000Z', freq: 'monthly' }),
    ).toBe('2026-10-14T12:00:00.000Z');
  });

  it('builds instance source keys', () => {
    expect(
      buildRecurrenceInstanceSourceKey({
        templateKey: 'tmpl-1',
        dueAtIso: '2026-09-21T12:00:00.000Z',
      }),
    ).toBe('recur:tmpl-1:2026-09-21T12:00:00.000Z');
  });

  it('keeps instance source_key distinct from template_key', () => {
    const key = buildRecurrenceInstanceSourceKey({
      templateKey: 'weekly-caja',
      dueAtIso: '2026-09-21T09:00:00.000Z',
    });
    expect(key).not.toBe('weekly-caja');
    expect(key.startsWith('recur:weekly-caja:')).toBe(true);
  });

  it('formats soft assumptions and labels', () => {
    expect(softDefaultAssumptionsLine(['asignado a vos', 'mañana 9:00'])).toContain(
      'Si confirmás',
    );
    expect(truncateLabel('a'.repeat(60)).endsWith('…')).toBe(true);
    expect(defaultDueIn24hIso(new Date('2026-09-14T00:00:00.000Z'))).toBe(
      '2026-09-15T00:00:00.000Z',
    );
    expect(defaultRemindAtFromDue('2026-09-15T12:00:00.000Z', 30)).toBe(
      '2026-09-15T11:30:00.000Z',
    );
    expect(todayYmd(new Date('2026-09-14T15:00:00.000Z'), 'UTC')).toBe('2026-09-14');
  });

  it('parses cash report ranges from Spanish phrases', () => {
    const now = new Date('2026-09-14T15:00:00.000Z');
    const tz = 'UTC';
    expect(parseCashReportRange('caja de hoy', now, tz)).toEqual({
      fromYmd: '2026-09-14',
      toYmd: '2026-09-14',
    });
    expect(parseCashReportRange('reporte de ayer', now, tz)).toEqual({
      fromYmd: '2026-09-13',
      toYmd: '2026-09-13',
    });
    expect(parseCashReportRange('caja de este mes', now, tz)).toEqual({
      fromYmd: '2026-09-01',
      toYmd: '2026-09-14',
    });
    expect(parseCashReportRange('caja esta semana', now, tz)).toEqual({
      fromYmd: '2026-09-14',
      toYmd: '2026-09-14',
    });
    expect(parseCashReportRange('caja del 2026-09-01 al 2026-09-10', now, tz)).toEqual({
      fromYmd: '2026-09-01',
      toYmd: '2026-09-10',
    });
  });
});
