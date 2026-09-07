import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  assertOrgMembership,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  mapCashLedgerEntry,
  type CashDayBalancesDto,
  type CashEntrySource,
  type CashEntryType,
  type CashLedgerEntryDto,
  type CashLedgerEntryRow,
  type CashRangeDayDto,
  type CashRangeReportDto,
} from './cash.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class CashService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getDayBalances(params: {
    authorizationHeader?: string;
    businessCenterId: string;
    entryDate: string;
    organizationId: string;
  }): Promise<CashDayBalancesDto> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    await this.assertBusinessCenter(params.organizationId, params.businessCenterId);

    const entryDate = this.requireDate(params.entryDate, 'entryDate');
    const client = this.supabaseService.getServiceRoleClient();

    const saldoInicialCents = await this.computeOpeningBalance({
      businessCenterId: params.businessCenterId,
      entryDate,
      organizationId: params.organizationId,
    });

    const { data, error } = await client
      .from('cash_ledger_entries')
      .select('*')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('entry_date', entryDate)
      .order('created_at', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const entries = ((data ?? []) as CashLedgerEntryRow[]).map(mapCashLedgerEntry);
    const ingresosCents = sumByType(entries, 'ingreso');
    const egresosCents = sumByType(entries, 'egreso');

    return {
      businessCenterId: params.businessCenterId,
      egresosCents,
      entries,
      entryDate,
      ingresosCents,
      organizationId: params.organizationId,
      saldoFinalCents: saldoInicialCents + ingresosCents - egresosCents,
      saldoInicialCents,
    };
  }

  async getRangeReport(params: {
    authorizationHeader?: string;
    businessCenterId: string;
    fromDate: string;
    organizationId: string;
    toDate: string;
  }): Promise<CashRangeReportDto> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    await this.assertBusinessCenter(params.organizationId, params.businessCenterId);

    const fromDate = this.requireDate(params.fromDate, 'fromDate');
    const toDate = this.requireDate(params.toDate, 'toDate');
    if (fromDate > toDate) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const openingCents = await this.computeOpeningBalance({
      businessCenterId: params.businessCenterId,
      entryDate: fromDate,
      organizationId: params.organizationId,
    });

    const { data, error } = await client
      .from('cash_ledger_entries')
      .select('*')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const entries = ((data ?? []) as CashLedgerEntryRow[]).map(mapCashLedgerEntry);
    const byDate = new Map<string, CashLedgerEntryDto[]>();
    for (const entry of entries) {
      const list = byDate.get(entry.entryDate) ?? [];
      list.push(entry);
      byDate.set(entry.entryDate, list);
    }

    const days: CashRangeDayDto[] = [];
    let running = openingCents;
    let cursor = fromDate;
    while (cursor <= toDate) {
      const dayEntries = byDate.get(cursor) ?? [];
      const ingresosCents = sumByType(dayEntries, 'ingreso');
      const egresosCents = sumByType(dayEntries, 'egreso');
      const saldoInicialCents = running;
      const saldoFinalCents = saldoInicialCents + ingresosCents - egresosCents;
      days.push({
        egresosCents,
        entryDate: cursor,
        ingresosCents,
        saldoFinalCents,
        saldoInicialCents,
      });
      running = saldoFinalCents;
      cursor = addDays(cursor, 1);
    }

    const ingresosCents = days.reduce((sum, day) => sum + day.ingresosCents, 0);
    const egresosCents = days.reduce((sum, day) => sum + day.egresosCents, 0);

    return {
      businessCenterId: params.businessCenterId,
      closingCents: running,
      days,
      egresosCents,
      fromDate,
      ingresosCents,
      openingCents,
      organizationId: params.organizationId,
      toDate,
    };
  }

  async createManualEntry(params: {
    amountCents: number;
    authorizationHeader?: string;
    businessCenterId: string;
    concept: string;
    entryDate: string;
    entryType: CashEntryType;
    organizationId: string;
  }): Promise<CashLedgerEntryDto> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    await this.assertBusinessCenter(params.organizationId, params.businessCenterId);

    const entryDate = this.requireDate(params.entryDate, 'entryDate');
    const amountCents = this.requirePositiveCents(params.amountCents);
    const concept = params.concept.trim();
    if (!concept) {
      throw new BadRequestException('El concepto es obligatorio.');
    }
    if (params.entryType !== 'ingreso' && params.entryType !== 'egreso') {
      throw new BadRequestException('entryType inválido.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('cash_ledger_entries')
      .insert({
        amount_cents: amountCents,
        business_center_id: params.businessCenterId,
        concept,
        created_by: user.id,
        entry_date: entryDate,
        entry_type: params.entryType,
        organization_id: params.organizationId,
        source: 'manual',
        source_id: null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'No se pudo crear el movimiento.');
    }

    return mapCashLedgerEntry(data as CashLedgerEntryRow);
  }

  async updateManualEntry(params: {
    amountCents?: number;
    authorizationHeader?: string;
    concept?: string;
    entryDate?: string;
    entryId: string;
    entryType?: CashEntryType;
    organizationId: string;
  }): Promise<CashLedgerEntryDto> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const existing = await this.getEntryOrThrow(params.organizationId, params.entryId);
    if (existing.source !== 'manual') {
      throw new ForbiddenException('Solo se pueden editar movimientos manuales.');
    }

    const patch: Record<string, unknown> = {};
    if (params.amountCents !== undefined) {
      patch.amount_cents = this.requirePositiveCents(params.amountCents);
    }
    if (params.concept !== undefined) {
      const concept = params.concept.trim();
      if (!concept) {
        throw new BadRequestException('El concepto es obligatorio.');
      }
      patch.concept = concept;
    }
    if (params.entryDate !== undefined) {
      patch.entry_date = this.requireDate(params.entryDate, 'entryDate');
    }
    if (params.entryType !== undefined) {
      if (params.entryType !== 'ingreso' && params.entryType !== 'egreso') {
        throw new BadRequestException('entryType inválido.');
      }
      patch.entry_type = params.entryType;
    }

    if (Object.keys(patch).length === 0) {
      return mapCashLedgerEntry(existing);
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('cash_ledger_entries')
      .update(patch)
      .eq('id', params.entryId)
      .eq('organization_id', params.organizationId)
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'No se pudo actualizar el movimiento.');
    }

    return mapCashLedgerEntry(data as CashLedgerEntryRow);
  }

  async deleteManualEntry(params: {
    authorizationHeader?: string;
    entryId: string;
    organizationId: string;
  }): Promise<{ ok: true }> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const existing = await this.getEntryOrThrow(params.organizationId, params.entryId);
    if (existing.source !== 'manual') {
      throw new ForbiddenException('Solo se pueden eliminar movimientos manuales.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('cash_ledger_entries')
      .delete()
      .eq('id', params.entryId)
      .eq('organization_id', params.organizationId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ok: true };
  }

  async upsertAutoEntry(params: {
    amountCents: number;
    authorizationHeader?: string;
    businessCenterId: string;
    concept: string;
    entryDate: string;
    entryType: CashEntryType;
    organizationId: string;
    source: Exclude<CashEntrySource, 'manual'>;
    sourceId: string;
  }): Promise<CashLedgerEntryDto> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    await this.assertBusinessCenter(params.organizationId, params.businessCenterId);

    if (params.source === 'manual' as CashEntrySource) {
      throw new BadRequestException('Use createManualEntry for manual movements.');
    }

    const sourceId = params.sourceId.trim();
    if (!sourceId) {
      throw new BadRequestException('sourceId es obligatorio.');
    }

    const entryDate = this.requireDate(params.entryDate, 'entryDate');
    const amountCents = this.requirePositiveCents(params.amountCents);
    const concept = params.concept.trim() || defaultAutoConcept(params.source);
    const client = this.supabaseService.getServiceRoleClient();

    const { data: existing, error: existingError } = await client
      .from('cash_ledger_entries')
      .select('*')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('source', params.source)
      .eq('source_id', sourceId)
      .maybeSingle();

    if (existingError) {
      throw new BadRequestException(existingError.message);
    }

    if (existing) {
      const { data, error } = await client
        .from('cash_ledger_entries')
        .update({
          amount_cents: amountCents,
          concept,
          entry_date: entryDate,
          entry_type: params.entryType,
        })
        .eq('id', (existing as CashLedgerEntryRow).id)
        .select('*')
        .single();

      if (error || !data) {
        throw new BadRequestException(error?.message ?? 'No se pudo actualizar el asiento.');
      }

      return mapCashLedgerEntry(data as CashLedgerEntryRow);
    }

    const { data, error } = await client
      .from('cash_ledger_entries')
      .insert({
        amount_cents: amountCents,
        business_center_id: params.businessCenterId,
        concept,
        created_by: user.id,
        entry_date: entryDate,
        entry_type: params.entryType,
        organization_id: params.organizationId,
        source: params.source,
        source_id: sourceId,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'No se pudo crear el asiento.');
    }

    return mapCashLedgerEntry(data as CashLedgerEntryRow);
  }

  async deleteAutoEntry(params: {
    authorizationHeader?: string;
    businessCenterId: string;
    organizationId: string;
    source: Exclude<CashEntrySource, 'manual'>;
    sourceId: string;
  }): Promise<{ ok: true }> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('cash_ledger_entries')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('source', params.source)
      .eq('source_id', params.sourceId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ok: true };
  }

  private async computeOpeningBalance(params: {
    businessCenterId: string;
    entryDate: string;
    organizationId: string;
  }): Promise<number> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('cash_ledger_entries')
      .select('entry_type, amount_cents')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .lt('entry_date', params.entryDate);

    if (error) {
      throw new BadRequestException(error.message);
    }

    let balance = 0;
    for (const row of data ?? []) {
      const amount = Number((row as { amount_cents: number }).amount_cents) || 0;
      const type = (row as { entry_type: CashEntryType }).entry_type;
      balance += type === 'ingreso' ? amount : -amount;
    }
    return balance;
  }

  private async getEntryOrThrow(
    organizationId: string,
    entryId: string,
  ): Promise<CashLedgerEntryRow> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('cash_ledger_entries')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', entryId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Movimiento no encontrado.');
    }
    return data as CashLedgerEntryRow;
  }

  private async assertBusinessCenter(
    organizationId: string,
    businessCenterId: string,
  ): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('id', businessCenterId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Sucursal no encontrada.');
    }
  }

  private requireDate(value: string, field: string): string {
    const trimmed = value.trim();
    if (!DATE_RE.test(trimmed)) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    }
    return trimmed;
  }

  private requirePositiveCents(value: number): number {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      throw new BadRequestException('El monto debe ser un entero positivo en centavos.');
    }
    return value;
  }
}

function sumByType(entries: CashLedgerEntryDto[], type: CashEntryType): number {
  return entries
    .filter((entry) => entry.entryType === type)
    .reduce((sum, entry) => sum + entry.amountCents, 0);
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultAutoConcept(source: Exclude<CashEntrySource, 'manual'>): string {
  switch (source) {
    case 'venta':
      return 'Venta';
    case 'compra':
      return 'Compra';
    case 'stock':
      return 'Agregar stock';
    default:
      return 'Movimiento';
  }
}
