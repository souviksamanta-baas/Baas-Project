export type CashEntryType = 'ingreso' | 'egreso';
export type CashEntrySource = 'manual' | 'venta' | 'compra' | 'stock';

export type CashLedgerEntryRow = {
  amount_cents: number;
  business_center_id: string;
  concept: string;
  created_at: string;
  created_by: string | null;
  entry_date: string;
  entry_type: CashEntryType;
  id: string;
  organization_id: string;
  source: CashEntrySource;
  source_id: string | null;
  updated_at: string;
};

export type CashLedgerEntryDto = {
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

export type CashDayBalancesDto = {
  businessCenterId: string;
  egresosCents: number;
  entries: CashLedgerEntryDto[];
  entryDate: string;
  ingresosCents: number;
  organizationId: string;
  saldoFinalCents: number;
  saldoInicialCents: number;
};

export type CashRangeDayDto = {
  egresosCents: number;
  entries: CashLedgerEntryDto[];
  entryDate: string;
  ingresosCents: number;
  saldoFinalCents: number;
  saldoInicialCents: number;
};

export type CashRangeReportDto = {
  businessCenterId: string;
  closingCents: number;
  days: CashRangeDayDto[];
  fromDate: string;
  egresosCents: number;
  ingresosCents: number;
  openingCents: number;
  organizationId: string;
  toDate: string;
};

export function mapCashLedgerEntry(row: CashLedgerEntryRow): CashLedgerEntryDto {
  return {
    amountCents: row.amount_cents,
    businessCenterId: row.business_center_id,
    concept: row.concept,
    createdAt: row.created_at,
    createdBy: row.created_by,
    entryDate: String(row.entry_date).slice(0, 10),
    entryType: row.entry_type,
    id: row.id,
    organizationId: row.organization_id,
    source: row.source,
    sourceId: row.source_id,
    updatedAt: row.updated_at,
  };
}
