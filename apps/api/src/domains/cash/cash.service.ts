import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  assertManagerOrAboveRole,
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
const SALE_COST_SOURCE_SUFFIX = ':costo';

type SaleCostLine = Record<string, unknown>;

function saleCostSourceId(sourceId: string): string {
  return sourceId.endsWith(SALE_COST_SOURCE_SUFFIX)
    ? sourceId
    : `${sourceId}${SALE_COST_SOURCE_SUFFIX}`;
}

function soldUnits(line: SaleCostLine): number {
  if (line.soldByWeight === true) {
    const gramsRaw = line.weightGramsInput;
    if (gramsRaw != null && String(gramsRaw).trim() !== '') {
      const grams = Number(String(gramsRaw).replace(',', '.'));
      if (Number.isFinite(grams) && grams > 0) {
        return grams / 1000;
      }
    }
    const quantity = Number(line.quantity);
    if (Number.isFinite(quantity) && quantity > 0) {
      return quantity;
    }
    return 1;
  }

  const quantity = Number(line.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function metadataNumber(metadata: unknown, key: string): number {
  if (!metadata || typeof metadata !== 'object') {
    return 0;
  }
  const value = (metadata as Record<string, unknown>)[key];
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function metadataCents(metadata: unknown, key: string): number {
  const parsed = metadataNumber(metadata, key);
  return parsed > 0 ? Math.round(parsed) : 0;
}

@Injectable()
export class CashService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getDayBalances(params: {
    authorizationHeader?: string;
    businessCenterId: string;
    entryDate: string;
    organizationId: string;
    userId?: string;
  }): Promise<CashDayBalancesDto> {
    await this.assertCashCaller(params);
    return this.getDayBalancesInternal({
      businessCenterId: params.businessCenterId,
      entryDate: params.entryDate,
      organizationId: params.organizationId,
    });
  }

  /** Service-role / Copi path — no auth header required. */
  async getDayBalancesInternal(params: {
    businessCenterId: string;
    entryDate: string;
    organizationId: string;
  }): Promise<CashDayBalancesDto> {
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
    userId?: string;
  }): Promise<CashRangeReportDto> {
    await this.assertCashCaller(params);
    return this.getRangeReportInternal({
      businessCenterId: params.businessCenterId,
      fromDate: params.fromDate,
      organizationId: params.organizationId,
      toDate: params.toDate,
    });
  }

  /** Service-role / Copi path — no auth header required. */
  async getRangeReportInternal(params: {
    businessCenterId: string;
    fromDate: string;
    organizationId: string;
    toDate: string;
  }): Promise<CashRangeReportDto> {
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
        entries: dayEntries,
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
    return this.createManualEntryForUser({
      amountCents: params.amountCents,
      businessCenterId: params.businessCenterId,
      concept: params.concept,
      entryDate: params.entryDate,
      entryType: params.entryType,
      organizationId: params.organizationId,
      userId: user.id,
    });
  }

  /** Copi / service-role path that already knows the acting user. */
  async createManualEntryForUser(params: {
    amountCents: number;
    businessCenterId: string;
    concept: string;
    entryDate: string;
    entryType: CashEntryType;
    organizationId: string;
    userId: string;
  }): Promise<CashLedgerEntryDto> {
    await this.assertCashWriter({
      organizationId: params.organizationId,
      userId: params.userId,
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
        created_by: params.userId,
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
    await this.assertCashWriter({
      organizationId: params.organizationId,
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
    await this.assertCashWriter({
      organizationId: params.organizationId,
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
    await this.assertCashWriter({
      organizationId: params.organizationId,
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

      const mapped = mapCashLedgerEntry(data as CashLedgerEntryRow);
      await this.syncSaleCostEntry({
        businessCenterId: params.businessCenterId,
        createdBy: user.id,
        entryDate,
        entryType: params.entryType,
        organizationId: params.organizationId,
        source: params.source,
        sourceId,
      });
      return mapped;
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

    const mapped = mapCashLedgerEntry(data as CashLedgerEntryRow);
    await this.syncSaleCostEntry({
      businessCenterId: params.businessCenterId,
      createdBy: user.id,
      entryDate,
      entryType: params.entryType,
      organizationId: params.organizationId,
      source: params.source,
      sourceId,
    });
    return mapped;
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
    await this.assertCashWriter({
      organizationId: params.organizationId,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const sourceId = params.sourceId.trim();
    const sourceIds =
      params.source === 'venta' && !sourceId.endsWith(SALE_COST_SOURCE_SUFFIX)
        ? [sourceId, saleCostSourceId(sourceId)]
        : [sourceId];
    const { error } = await client
      .from('cash_ledger_entries')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('source', params.source)
      .in('source_id', sourceIds);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ok: true };
  }

  private async assertCashCaller(params: {
    authorizationHeader?: string;
    organizationId: string;
    userId?: string;
  }): Promise<void> {
    const userId =
      params.userId?.trim() ||
      (await resolveAuthUser(this.supabaseService, params.authorizationHeader)).id;
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId,
    });
  }

  /** Staff may read cash; only owner/co_owner/manager may mutate the ledger. */
  private async assertCashWriter(params: {
    organizationId: string;
    userId: string;
  }): Promise<void> {
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: params.userId,
    });
    assertManagerOrAboveRole(role);
  }

  private async computeOpeningBalance(params: {
    businessCenterId: string;
    entryDate: string;
    organizationId: string;
  }): Promise<number> {
    const client = this.supabaseService.getServiceRoleClient();

    const { data, error } = await client
      .from('cash_ledger_entries')
      .select('entry_type, amount_cents.sum()')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .lt('entry_date', params.entryDate);

    if (!error && data) {
      let balance = 0;
      for (const row of data as Array<Record<string, unknown>>) {
        const amount = Number(row.amount_cents ?? row.sum ?? 0) || 0;
        const type = row.entry_type as CashEntryType;
        balance += type === 'ingreso' ? amount : -amount;
      }
      return balance;
    }

    // Fallback if aggregates are unavailable on the project.
    const fallback = await client
      .from('cash_ledger_entries')
      .select('entry_type, amount_cents')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .lt('entry_date', params.entryDate);

    if (fallback.error) {
      throw new BadRequestException(fallback.error.message);
    }

    let balance = 0;
    for (const row of fallback.data ?? []) {
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

  private async syncSaleCostEntry(params: {
    businessCenterId: string;
    createdBy: string;
    entryDate: string;
    entryType: CashEntryType;
    organizationId: string;
    source: Exclude<CashEntrySource, 'manual'>;
    sourceId: string;
  }): Promise<void> {
    if (
      params.source !== 'venta' ||
      params.entryType !== 'ingreso' ||
      params.sourceId.endsWith(SALE_COST_SOURCE_SUFFIX)
    ) {
      return;
    }

    const client = this.supabaseService.getServiceRoleClient();
    const costSourceId = saleCostSourceId(params.sourceId);
    const amountCents = await this.quoteProductCostCents(
      params.organizationId,
      params.sourceId,
    );
    const { data: existing, error: existingError } = await client
      .from('cash_ledger_entries')
      .select('id')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('source', 'venta')
      .eq('source_id', costSourceId)
      .maybeSingle();

    if (existingError) {
      throw new BadRequestException(existingError.message);
    }

    if (amountCents <= 0) {
      if (!existing) {
        return;
      }
      const { error } = await client
        .from('cash_ledger_entries')
        .delete()
        .eq('id', (existing as { id: string }).id);
      if (error) {
        throw new BadRequestException(error.message);
      }
      return;
    }

    const concept = `Venta #${params.sourceId}`;
    if (existing) {
      const { error } = await client
        .from('cash_ledger_entries')
        .update({
          amount_cents: amountCents,
          concept,
          entry_date: params.entryDate,
          entry_type: 'egreso',
        })
        .eq('id', (existing as { id: string }).id);
      if (error) {
        throw new BadRequestException(error.message);
      }
      return;
    }

    const { error } = await client.from('cash_ledger_entries').insert({
      amount_cents: amountCents,
      business_center_id: params.businessCenterId,
      concept,
      created_by: params.createdBy,
      entry_date: params.entryDate,
      entry_type: 'egreso',
      organization_id: params.organizationId,
      source: 'venta',
      source_id: costSourceId,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
  }

  private async quoteProductCostCents(
    organizationId: string,
    quoteId: string,
  ): Promise<number> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('sell_quotes')
      .select('draft')
      .eq('organization_id', organizationId)
      .eq('id', quoteId)
      .maybeSingle();

    if (error || !data) {
      return 0;
    }

    const draft = (data as { draft?: { cart?: unknown } }).draft;
    const cart = Array.isArray(draft?.cart) ? draft.cart : [];
    const lines = cart.filter(
      (line): line is SaleCostLine => Boolean(line) && typeof line === 'object',
    );
    if (!lines.length) {
      return 0;
    }

    const costs = await this.productUnitCosts(organizationId, lines);
    return lines.reduce((sum, line) => {
      const units = soldUnits(line);
      const direct = Math.round(Number(line.unitCostCents) || 0);
      const unit = direct > 0 ? direct : costs(line);
      if (units <= 0 || unit <= 0) {
        return sum;
      }
      return sum + Math.round(unit * units);
    }, 0);
  }

  private async productUnitCosts(
    organizationId: string,
    lines: SaleCostLine[],
  ): Promise<(line: SaleCostLine) => number> {
    const client = this.supabaseService.getServiceRoleClient();
    const ids = [
      ...new Set(lines.map((line) => String(line.productId || '').trim()).filter(Boolean)),
    ];
    const names = [
      ...new Set(lines.map((line) => String(line.name || '').trim()).filter(Boolean)),
    ];
    const products: Array<{
      id: string;
      metadata: unknown;
      name: string;
      parent_product_id: string | null;
    }> = [];

    if (ids.length) {
      const { data } = await client
        .from('products')
        .select('id, name, metadata, parent_product_id')
        .eq('organization_id', organizationId)
        .in('id', ids);
      products.push(...((data || []) as typeof products));
    }
    if (names.length) {
      const { data } = await client
        .from('products')
        .select('id, name, metadata, parent_product_id')
        .eq('organization_id', organizationId)
        .in('name', names);
      for (const row of (data || []) as typeof products) {
        if (!products.some((product) => product.id === row.id)) {
          products.push(row);
        }
      }
    }

    const parentIds = [
      ...new Set(
        products
          .filter((product) => metadataCents(product.metadata, 'precio_costo_cents') <= 0)
          .map((product) => product.parent_product_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const parents = new Map<string, unknown>();
    if (parentIds.length) {
      const { data } = await client
        .from('products')
        .select('id, metadata')
        .eq('organization_id', organizationId)
        .in('id', parentIds);
      for (const row of (data || []) as Array<{ id: string; metadata: unknown }>) {
        parents.set(row.id, row.metadata);
      }
    }

    const missingIds = products
      .filter((product) => this.unitCostForProduct(product, parents) <= 0)
      .map((product) => product.id);
    const lotCosts = new Map<string, number>();
    if (missingIds.length) {
      const { data } = await client
        .from('inventory_lots')
        .select('product_id, unit_cost_cents, received_at')
        .eq('organization_id', organizationId)
        .in('product_id', missingIds)
        .order('received_at', { ascending: false });
      for (const row of (data || []) as Array<{
        product_id: string;
        unit_cost_cents: number | null;
      }>) {
        const cents = Math.round(Number(row.unit_cost_cents) || 0);
        if (cents > 0 && !lotCosts.has(row.product_id)) {
          lotCosts.set(row.product_id, cents);
        }
      }
    }

    return (line) => {
      const productId = String(line.productId || '').trim();
      const name = String(line.name || '').trim().toLocaleLowerCase('es');
      const product =
        products.find((item) => productId && item.id === productId) ||
        products.find((item) => item.name.trim().toLocaleLowerCase('es') === name);
      if (!product) {
        return 0;
      }
      return this.unitCostForProduct(product, parents) || lotCosts.get(product.id) || 0;
    };
  }

  private unitCostForProduct(
    product: {
      metadata: unknown;
      parent_product_id: string | null;
    },
    parents: Map<string, unknown>,
  ): number {
    const direct = metadataCents(product.metadata, 'precio_costo_cents');
    if (direct > 0) {
      return direct;
    }
    if (!product.parent_product_id) {
      return 0;
    }
    const parentCost = metadataCents(
      parents.get(product.parent_product_id),
      'precio_costo_cents',
    );
    const equivalent = metadataNumber(product.metadata, 'equivalente_unidad_base');
    if (parentCost <= 0 || equivalent <= 0) {
      return 0;
    }
    return Math.round(parentCost * equivalent);
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
