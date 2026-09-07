import { apiFetchAuthJson } from './client';
import { shiftIsoDate } from '../lib/cashUi';

export type CashEntryType = 'ingreso' | 'egreso';
export type CashEntrySource = 'manual' | 'venta' | 'compra' | 'stock';

export type CashLedgerEntry = {
  amountCents: number;
  businessCenterId: string;
  concept: string;
  createdAt: string;
  createdBy: string | null;
  entryDate: string;
  entryType: CashEntryType;
  id: string;
  organizationId: string;
  source: CashEntrySource;
  sourceId: string | null;
  updatedAt: string;
};

export type CashDayBalances = {
  businessCenterId: string;
  egresosCents: number;
  entries: CashLedgerEntry[];
  entryDate: string;
  ingresosCents: number;
  organizationId: string;
  saldoFinalCents: number;
  saldoInicialCents: number;
};

export type CashRangeDay = {
  egresosCents: number;
  entries: CashLedgerEntry[];
  entryDate: string;
  ingresosCents: number;
  saldoFinalCents: number;
  saldoInicialCents: number;
};

export type CashRangeReport = {
  businessCenterId: string;
  closingCents: number;
  days: CashRangeDay[];
  egresosCents: number;
  fromDate: string;
  ingresosCents: number;
  openingCents: number;
  organizationId: string;
  toDate: string;
};

function qs(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

function normalizeReport(report: CashRangeReport): CashRangeReport {
  return {
    ...report,
    days: (report.days ?? []).map((day) => ({
      ...day,
      entries: Array.isArray(day.entries) ? day.entries : [],
    })),
  };
}

export async function getCashDay(params: {
  businessCenterId: string;
  entryDate: string;
  organizationId: string;
}): Promise<CashDayBalances> {
  return apiFetchAuthJson<CashDayBalances>(
    `/cash/day?${qs({
      businessCenterId: params.businessCenterId,
      entryDate: params.entryDate,
      organizationId: params.organizationId,
    })}`,
  );
}

/** One round-trip range report (includes per-day entries when API is current). */
export async function getCashRangeReport(params: {
  businessCenterId: string;
  fromDate: string;
  organizationId: string;
  toDate: string;
}): Promise<CashRangeReport> {
  const report = await apiFetchAuthJson<CashRangeReport>(
    `/cash/report?${qs({
      businessCenterId: params.businessCenterId,
      fromDate: params.fromDate,
      organizationId: params.organizationId,
      toDate: params.toDate,
    })}`,
  );
  return normalizeReport(report);
}

/** Recent ledger days (newest first) via a single /cash/report call. */
export async function listCashRecentDays(params: {
  businessCenterId: string;
  dayCount: number;
  organizationId: string;
  toDate: string;
}): Promise<CashRangeDay[]> {
  const count = Math.max(1, params.dayCount);
  const fromDate = shiftIsoDate(params.toDate, -(count - 1));
  const report = await getCashRangeReport({
    businessCenterId: params.businessCenterId,
    fromDate,
    organizationId: params.organizationId,
    toDate: params.toDate,
  });
  return [...report.days].reverse();
}

export function rangeDayToBalances(
  day: CashRangeDay,
  params: { businessCenterId: string; organizationId: string },
): CashDayBalances {
  return {
    businessCenterId: params.businessCenterId,
    egresosCents: day.egresosCents,
    entries: day.entries ?? [],
    entryDate: day.entryDate,
    ingresosCents: day.ingresosCents,
    organizationId: params.organizationId,
    saldoFinalCents: day.saldoFinalCents,
    saldoInicialCents: day.saldoInicialCents,
  };
}

export async function createCashManualEntry(params: {
  amountCents: number;
  businessCenterId: string;
  concept: string;
  entryDate: string;
  entryType: CashEntryType;
  organizationId: string;
}): Promise<CashLedgerEntry> {
  return apiFetchAuthJson<CashLedgerEntry>('/cash/entries', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function updateCashManualEntry(params: {
  amountCents?: number;
  concept?: string;
  entryDate?: string;
  entryId: string;
  entryType?: CashEntryType;
  organizationId: string;
}): Promise<CashLedgerEntry> {
  const { entryId, ...body } = params;
  return apiFetchAuthJson<CashLedgerEntry>(`/cash/entries/${encodeURIComponent(entryId)}`, {
    body: JSON.stringify(body),
    method: 'PATCH',
  });
}

export async function deleteCashManualEntry(params: {
  entryId: string;
  organizationId: string;
}): Promise<{ ok: true }> {
  return apiFetchAuthJson<{ ok: true }>(
    `/cash/entries/${encodeURIComponent(params.entryId)}?organizationId=${encodeURIComponent(params.organizationId)}`,
    { method: 'DELETE' },
  );
}

export async function upsertCashAutoEntry(params: {
  amountCents: number;
  businessCenterId: string;
  concept: string;
  entryDate: string;
  entryType: CashEntryType;
  organizationId: string;
  source: Exclude<CashEntrySource, 'manual'>;
  sourceId: string;
}): Promise<CashLedgerEntry> {
  return apiFetchAuthJson<CashLedgerEntry>('/cash/entries/auto', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function deleteCashAutoEntry(params: {
  businessCenterId: string;
  organizationId: string;
  source: Exclude<CashEntrySource, 'manual'>;
  sourceId: string;
}): Promise<{ ok: true }> {
  return apiFetchAuthJson<{ ok: true }>('/cash/entries/auto/delete', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}
