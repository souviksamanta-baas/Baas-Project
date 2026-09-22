import { describe, expect, it } from 'vitest';

import { dateInputToIsoDate, isoDateToDateInput } from './addStockForm';

describe('purchase calendar dates', () => {
  it('stores día/mes/año as a Postgres date', () => {
    expect(dateInputToIsoDate('21/09/2026')).toBe('2026-09-21');
  });

  it('keeps an ISO calendar date', () => {
    expect(dateInputToIsoDate('2026-09-21')).toBe('2026-09-21');
    expect(dateInputToIsoDate('2026-09-21T12:00:00.000Z')).toBe('2026-09-21');
  });

  it('rejects dates Postgres would reject', () => {
    expect(dateInputToIsoDate('32/09/2026')).toBeNull();
    expect(dateInputToIsoDate('21/13/2026')).toBeNull();
    expect(dateInputToIsoDate('')).toBeNull();
  });

  it('shows a stored date as día/mes/año', () => {
    expect(isoDateToDateInput('2026-09-21')).toBe('21/09/2026');
    expect(isoDateToDateInput('21/09/2026')).toBe('21/09/2026');
  });
});
