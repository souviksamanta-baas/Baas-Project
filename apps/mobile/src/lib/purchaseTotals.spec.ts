import { describe, expect, it } from 'vitest';

import { computePurchaseTotals, normalizeIvaRatePercent } from './purchaseTotals';

describe('computePurchaseTotals', () => {
  it('sums lines only when IVA and ajuste are off', () => {
    const totals = computePurchaseTotals({
      adjustmentKind: null,
      adjustmentMode: null,
      adjustmentValue: 0,
      ivaEnabled: false,
      ivaRatePercent: 21,
      lineSubtotalCents: 10000,
    });

    expect(totals).toEqual({
      adjustmentCents: 0,
      ivaCents: 0,
      subtotalCents: 10000,
      totalCents: 10000,
    });
  });

  it('applies percent discount before IVA when enabled', () => {
    const totals = computePurchaseTotals({
      adjustmentKind: 'discount',
      adjustmentMode: 'percent',
      adjustmentValue: 10,
      ivaEnabled: true,
      ivaRatePercent: 21,
      lineSubtotalCents: 10000,
    });

    // 10000 - 1000 = 9000; IVA 21% of 9000 = 1890; total 10890
    expect(totals.adjustmentCents).toBe(-1000);
    expect(totals.ivaCents).toBe(1890);
    expect(totals.totalCents).toBe(10890);
  });

  it('ignores alícuota when IVA checkbox is off', () => {
    const totals = computePurchaseTotals({
      adjustmentKind: null,
      adjustmentMode: null,
      adjustmentValue: 0,
      ivaEnabled: false,
      ivaRatePercent: 27,
      lineSubtotalCents: 5000,
    });

    expect(totals.ivaCents).toBe(0);
    expect(totals.totalCents).toBe(5000);
  });
});

describe('normalizeIvaRatePercent', () => {
  it('defaults unknown rates to 21', () => {
    expect(normalizeIvaRatePercent(12)).toBe(21);
    expect(normalizeIvaRatePercent(10.5)).toBe(10.5);
  });
});
