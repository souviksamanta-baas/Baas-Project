/** Shared cash UI helpers (Caja + Informe · Movimientos). */

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export function shiftMonth(yyyyMm: string, deltaMonths: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1 + deltaMonths, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(yyyyMm: string): { fromDate: string; toDate: string } {
  const [y, m] = yyyyMm.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return {
    fromDate: `${yyyyMm}-01`,
    toDate: `${yyyyMm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatCashDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

export function formatCashDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
  });
}

export function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1));
  return date.toLocaleDateString('es-AR', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

export function buildMonthCells(
  yyyyMm: string,
): Array<{ date: string | null; day: number | null }> {
  const [y, m] = yyyyMm.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(y!, m! - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < mondayOffset; i += 1) {
    cells.push({ date: null, day: null });
  }

  for (let day = 1; day <= lastDay; day += 1) {
    cells.push({
      date: `${yyyyMm}-${String(day).padStart(2, '0')}`,
      day,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }

  return cells;
}

/** Matches bank-style amounts: `$ 12.500,00` / `$ -10.300,00`. */
export function formatCashMovementAmount(signedCents: number): string {
  const formatted = Math.abs(signedCents / 100).toLocaleString('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  if (signedCents < 0) {
    return `$ -${formatted}`;
  }
  return `$ ${formatted}`;
}

export function monthsApartInclusive(fromDate: string, toDate: string): number {
  const [fy, fm] = fromDate.split('-').map(Number);
  const [ty, tm] = toDate.split('-').map(Number);
  return (ty! - fy!) * 12 + (tm! - fm!) + 1;
}

/** True when the inclusive span exceeds three calendar months. */
export function exceedsThreeMonthSpan(fromDate: string, toDate: string): boolean {
  if (fromDate > toDate) {
    return true;
  }
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const max = new Date(Date.UTC(fy!, fm! - 1 + 3, fd!));
  // Same day-of-month three months later (clamped by JS Date), exclusive upper bound.
  const maxIso = max.toISOString().slice(0, 10);
  return toDate > maxIso;
}

export const CASH_WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export type CashDayTone = 'green' | 'red' | 'grey';

export function cashDayTone(ingresosCents: number, egresosCents: number): CashDayTone {
  if (ingresosCents > egresosCents) {
    return 'green';
  }
  if (ingresosCents < egresosCents) {
    return 'red';
  }
  return 'grey';
}
