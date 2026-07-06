import { describe, expect, it } from 'vitest';

import { getZonedDayBounds } from '../src/domains/ai/copi-timezone.util';

describe('getZonedDayBounds', () => {
  it('counts a Cordoba evening sale as yesterday', () => {
    const reference = new Date('2026-07-06T17:18:00.000Z');
    const saleAt = new Date('2026-07-06T00:11:45.504Z');
    const { end, start } = getZonedDayBounds(reference, 'America/Argentina/Cordoba', -1);

    expect(saleAt.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(saleAt.getTime()).toBeLessThan(end.getTime());
  });
});
