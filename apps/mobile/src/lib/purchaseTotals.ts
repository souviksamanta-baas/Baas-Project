/** Purchase document totals: lines → ajuste → IVA → total. */

export type AdjustmentKind = 'discount' | 'surcharge';
export type AdjustmentMode = 'percent' | 'fixed';

export const IVA_RATE_OPTIONS = [0, 10.5, 21, 27] as const;
export type IvaRatePercent = (typeof IVA_RATE_OPTIONS)[number];

export type PurchaseTotalsInput = {
  adjustmentKind: AdjustmentKind | null;
  adjustmentMode: AdjustmentMode | null;
  adjustmentValue: number;
  ivaEnabled: boolean;
  ivaRatePercent: number;
  lineSubtotalCents: number;
};

export type PurchaseTotals = {
  adjustmentCents: number;
  ivaCents: number;
  subtotalCents: number;
  totalCents: number;
};

export function normalizeIvaRatePercent(value: unknown): IvaRatePercent {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (numeric === 0 || numeric === 10.5 || numeric === 21 || numeric === 27) {
    return numeric;
  }
  return 21;
}

export function computePurchaseTotals(input: PurchaseTotalsInput): PurchaseTotals {
  const subtotalCents = Math.max(0, Math.round(input.lineSubtotalCents));
  let adjustmentCents = 0;

  if (input.adjustmentKind && input.adjustmentMode && Number.isFinite(input.adjustmentValue)) {
    const raw =
      input.adjustmentMode === 'percent'
        ? Math.round((subtotalCents * Math.abs(input.adjustmentValue)) / 100)
        : Math.round(Math.abs(input.adjustmentValue) * 100);

    adjustmentCents = input.adjustmentKind === 'discount' ? -raw : raw;
  }

  const adjustedNet = Math.max(0, subtotalCents + adjustmentCents);
  const rate = normalizeIvaRatePercent(input.ivaRatePercent);
  const ivaCents =
    input.ivaEnabled && rate > 0 ? Math.round((adjustedNet * rate) / 100) : 0;

  return {
    adjustmentCents,
    ivaCents,
    subtotalCents,
    totalCents: adjustedNet + ivaCents,
  };
}
