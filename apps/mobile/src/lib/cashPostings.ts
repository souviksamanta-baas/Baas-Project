import {
  deleteCashAutoEntry,
  upsertCashAutoEntry,
} from '../api/cash';

/** Best-effort auto posting — never blocks the source operation. */
export async function postCashAutoQuietly(params: {
  amountCents: number;
  businessCenterId: string;
  concept: string;
  entryDate: string;
  entryType: 'ingreso' | 'egreso';
  organizationId: string;
  source: 'venta' | 'compra' | 'stock';
  sourceId: string;
}): Promise<void> {
  if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
    return;
  }

  try {
    await upsertCashAutoEntry(params);
  } catch {
    // Non-blocking: Caja can lag behind ops if the API is unreachable.
  }
}

export async function removeCashAutoQuietly(params: {
  businessCenterId: string;
  organizationId: string;
  source: 'venta' | 'compra' | 'stock';
  sourceId: string;
}): Promise<void> {
  try {
    await deleteCashAutoEntry(params);
  } catch {
    // Non-blocking.
  }
}

export function todayIsoDate(timeZone?: string | null): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: timeZone || undefined,
      year: 'numeric',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) {
      return `${y}-${m}-${d}`;
    }
  } catch {
    // fall through
  }
  return new Date().toISOString().slice(0, 10);
}
