import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { assertOrgMembership, resolveAuthUser } from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';
import { ArcaAuthService } from '../arca/arca-auth.service';
import { ArcaConnectionService } from '../arca/arca-connection.service';
import { ArcaPdfService } from '../arca/arca-pdf.service';
import { ArcaQrService } from '../arca/arca-qr.service';
import { ArcaWsfeService } from '../arca/arca-wsfe.service';
import {
  AFIP_DOC_TYPE_CODES,
  AFIP_VOUCHER_TYPE_CODES,
  type ArcaAccountRow,
  type IssuedInvoiceResult,
  type IssueInvoiceInput,
  type TaxCondition,
  type VoucherTypeCode,
  resolveVoucherType,
} from '../arca/arca.types';

const LOCK_TTL_MS = 60_000;

type InvoiceRow = {
  arca_response?: { mock?: boolean; raw?: string } | null;
  arca_status: string;
  cae: string | null;
  cae_expiration?: string | null;
  customer_name?: string | null;
  id: string;
  pdf_storage_path?: string | null;
  qr_url?: string | null;
  sell_quote_id?: string | null;
  total_amount_cents?: number | null;
  voucher_number: number | null;
  voucher_type?: string | null;
};

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly auth: ArcaAuthService,
    private readonly connection: ArcaConnectionService,
    private readonly pdf: ArcaPdfService,
    private readonly qr: ArcaQrService,
    private readonly supabaseService: SupabaseService,
    private readonly wsfe: ArcaWsfeService,
  ) {}

  async issueInvoice(params: {
    authorizationHeader?: string;
    input: IssueInvoiceInput;
  }): Promise<IssuedInvoiceResult> {
    try {
      return await this.issueInvoiceInner(params);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `issueInvoice failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo emitir la factura en ARCA.',
      );
    }
  }

  private async issueInvoiceInner(params: {
    authorizationHeader?: string;
    input: IssueInvoiceInput;
  }): Promise<IssuedInvoiceResult> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    await assertOrgMembership({
      organizationId: params.input.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    if (!params.input.lines.length) {
      throw new BadRequestException('La factura necesita al menos un ítem.');
    }

    const account = await this.connection.requireConnectedAccount(params.input.organizationId);
    const voucherType =
      params.input.voucherType ||
      resolveVoucherType(account.tax_condition, params.input.customerTaxCondition ?? null);
    const voucherTypeCode = AFIP_VOUCHER_TYPE_CODES[voucherType];
    const lockId = randomUUID();

    await this.acquireLock({
      organizationId: account.organization_id,
      cuit: account.cuit,
      pointOfSale: account.point_of_sale,
      voucherTypeCode,
      lockedBy: lockId,
    });

    try {
      return await this.issueInvoiceWithLock({
        account,
        input: params.input,
        lockId,
        userId: user.id,
        voucherType,
        voucherTypeCode,
      });
    } finally {
      await this.releaseLock({
        organizationId: account.organization_id,
        pointOfSale: account.point_of_sale,
        voucherTypeCode,
        lockedBy: lockId,
      });
    }
  }

  private async issueInvoiceWithLock(params: {
    account: ArcaAccountRow;
    input: IssueInvoiceInput;
    lockId: string;
    userId: string;
    voucherType: VoucherTypeCode;
    voucherTypeCode: number;
  }): Promise<IssuedInvoiceResult> {
    const { account, input, userId, voucherType, voucherTypeCode } = params;
    const ticket = await this.auth.getTicket(account);
      const client = this.supabaseService.getServiceRoleClient();

      // Idempotent: do not double-issue for the same presupuesto.
      if (input.sellQuoteId) {
        const existingForQuote = await this.findInvoiceForQuote({
          client,
          organizationId: account.organization_id,
          sellQuoteId: input.sellQuoteId,
        });
        if (existingForQuote?.arca_status === 'authorized' && existingForQuote.cae) {
          return this.toIssuedResult(existingForQuote, voucherType);
        }
        if (
          existingForQuote &&
          (existingForQuote.arca_status === 'pending' || existingForQuote.arca_status === 'error')
        ) {
          return this.completePendingInvoice({
            account,
            client,
            existing: existingForQuote,
            input,
            ticket,
            userId,
            voucherType,
            voucherTypeCode,
          });
        }
      }

      const arcaLast = await this.wsfe.getLastAuthorizedNumber({
        account,
        ticket,
        voucherTypeCode,
      });
      const allocated = await this.allocateVoucherNumber({
        account,
        arcaLast,
        client,
        ticket,
        voucherTypeCode,
      });
      const nextNumber = allocated.voucherNumber;

      const totals = computeTotals(input.lines);
      const issueDate = new Date().toISOString().slice(0, 10);

      let invoiceId = allocated.reuseInvoiceId;
      if (invoiceId) {
        const { error: reuseError } = await client
          .from('invoices')
          .update({
            sell_quote_id: input.sellQuoteId ?? null,
            contact_id: input.contactId ?? null,
            created_by: userId,
            voucher_type: voucherType,
            issue_date: issueDate,
            net_amount_cents: totals.netCents,
            vat_amount_cents: totals.vatCents,
            exempt_amount_cents: 0,
            total_amount_cents: totals.totalCents,
            customer_document_type: input.customerDocumentType ?? 'CF',
            customer_document_number: input.customerDocumentNumber ?? '0',
            customer_tax_condition: input.customerTaxCondition ?? 'consumidor_final',
            customer_name: input.customerName ?? 'Consumidor final',
            line_items: input.lines,
            related_invoice_id: input.relatedInvoiceId ?? null,
            arca_status: 'pending',
            last_error: null,
            cae: null,
            cae_expiration: null,
            qr_url: null,
            pdf_storage_path: null,
            arca_response: {},
          })
          .eq('id', invoiceId);
        if (reuseError) {
          throw new BadRequestException(reuseError.message);
        }
      } else {
        const { data: draft, error: insertError } = await client
          .from('invoices')
          .insert({
            organization_id: account.organization_id,
            sell_quote_id: input.sellQuoteId ?? null,
            contact_id: input.contactId ?? null,
            created_by: userId,
            voucher_type: voucherType,
            voucher_type_code: voucherTypeCode,
            point_of_sale: account.point_of_sale,
            voucher_number: nextNumber,
            issue_date: issueDate,
            net_amount_cents: totals.netCents,
            vat_amount_cents: totals.vatCents,
            exempt_amount_cents: 0,
            total_amount_cents: totals.totalCents,
            customer_document_type: input.customerDocumentType ?? 'CF',
            customer_document_number: input.customerDocumentNumber ?? '0',
            customer_tax_condition: input.customerTaxCondition ?? 'consumidor_final',
            customer_name: input.customerName ?? 'Consumidor final',
            line_items: input.lines,
            related_invoice_id: input.relatedInvoiceId ?? null,
            arca_status: 'pending',
          })
          .select('id')
          .single();

        if (insertError || !draft) {
          throw new BadRequestException(
            insertError?.message ?? 'No se pudo crear el borrador de factura.',
          );
        }
        invoiceId = draft.id as string;
      }

      return this.authorizeDraftInvoice({
        account,
        client,
        input,
        invoiceId,
        issueDate,
        nextNumber,
        ticket,
        totals,
        voucherType,
        voucherTypeCode,
      });
  }

  private async authorizeDraftInvoice(params: {
    account: ArcaAccountRow;
    client: ReturnType<SupabaseService['getServiceRoleClient']>;
    input: IssueInvoiceInput;
    invoiceId: string;
    issueDate: string;
    nextNumber: number;
    ticket: Awaited<ReturnType<ArcaAuthService['getTicket']>>;
    totals: { netCents: number; totalCents: number; vatCents: number };
    voucherType: VoucherTypeCode;
    voucherTypeCode: number;
  }): Promise<IssuedInvoiceResult> {
    const {
      account,
      client,
      input,
      invoiceId,
      issueDate,
      nextNumber,
      ticket,
      totals,
      voucherType,
      voucherTypeCode,
    } = params;

    let caeResult;

    try {
      caeResult = await this.wsfe.requestCae({
        account,
        ticket,
        voucherTypeCode,
        voucherNumber: nextNumber,
        issueDate,
        lines: input.lines,
        totalCents: totals.totalCents,
        customerDocumentType: input.customerDocumentType ?? 'CF',
        customerDocumentNumber: input.customerDocumentNumber ?? '0',
        customerTaxCondition: input.customerTaxCondition ?? 'consumidor_final',
      });
    } catch (error) {
      // Ambiguous failure — consult before deciding.
      this.logger.warn(
        `FECAESolicitar uncertain: ${error instanceof Error ? error.message : String(error)}`,
      );
      const consulted = await this.wsfe.consultComprobante({
        account,
        ticket,
        voucherTypeCode,
        voucherNumber: nextNumber,
      });
      if (consulted.exists && consulted.cae) {
        caeResult = {
          cae: consulted.cae,
          caeExpiration: consulted.caeExpiration ?? issueDate,
          raw: consulted.raw,
          rejected: false,
          voucherNumber: nextNumber,
        };
      } else {
        await client
          .from('invoices')
          .update({
            arca_status: 'error',
            last_error: error instanceof Error ? error.message : 'Error al solicitar CAE',
            arca_response: { error: String(error) },
          })
          .eq('id', invoiceId);
        throw error instanceof Error ? error : new BadRequestException(String(error));
      }
    }

    if (caeResult.rejected) {
      await client
        .from('invoices')
        .update({
          arca_status: 'rejected',
          last_error: caeResult.rejectionReason ?? 'Rechazada por ARCA',
          arca_response: { raw: caeResult.raw },
        })
        .eq('id', invoiceId);
      throw new BadRequestException(caeResult.rejectionReason ?? 'ARCA rechazó la factura.');
    }

    const docTypeCode =
      AFIP_DOC_TYPE_CODES[input.customerDocumentType ?? 'CF'] ?? AFIP_DOC_TYPE_CODES.CF;
    const qrUrl = this.qr.buildQrUrl({
      cae: caeResult.cae,
      cuit: account.cuit,
      currency: 'ARS',
      customerDocumentNumber: input.customerDocumentNumber ?? '0',
      customerDocumentTypeCode: docTypeCode,
      issueDate,
      pointOfSale: account.point_of_sale,
      totalAmount: totals.totalCents / 100,
      voucherNumber: nextNumber,
      voucherTypeCode,
    });

    const org = await this.loadOrgFiscalProfile(account.organization_id);
    const pdfBuffer = await this.pdf.buildPdf({
      businessName: org.legalName,
      cae: caeResult.cae,
      caeExpiration: caeResult.caeExpiration,
      cuit: account.cuit,
      customerDocumentNumber: input.customerDocumentNumber,
      customerDocumentType: input.customerDocumentType,
      customerName: input.customerName ?? 'Consumidor final',
      customerTaxCondition: input.customerTaxCondition ?? 'consumidor_final',
      emitterAddress: org.address,
      emitterTaxCondition: account.tax_condition,
      fantasyName: org.fantasyName,
      issueDate,
      lines: input.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        totalCents: Math.round(line.unitPriceCents * line.quantity),
        unitPriceCents: line.unitPriceCents,
      })),
      pointOfSale: account.point_of_sale,
      qrUrl,
      totalAmountCents: totals.totalCents,
      voucherNumber: nextNumber,
      voucherType,
      voucherTypeCode,
    });

    const pdfPath = `invoices/${account.organization_id}/${this.qr.invoiceFileKey(invoiceId)}.pdf`;
    const pdfBase64 = pdfBuffer.toString('base64');

    const { error: updateError } = await client
      .from('invoices')
      .update({
        arca_status: 'authorized',
        cae: caeResult.cae,
        cae_expiration: caeResult.caeExpiration,
        qr_url: qrUrl,
        pdf_storage_path: pdfPath,
        arca_response: { raw: caeResult.raw, pdfBase64, pdfTemplate: 'afip_v1' },
        last_error: null,
      })
      .eq('id', invoiceId);

    if (updateError) {
      throw new BadRequestException(updateError.message);
    }

    return {
      cae: caeResult.cae,
      caeExpiration: caeResult.caeExpiration,
      id: invoiceId,
      pdfStoragePath: pdfPath,
      qrUrl,
      status: 'authorized',
      totalAmountCents: totals.totalCents,
      voucherNumber: nextNumber,
      voucherType,
    };
  }

  private async completePendingInvoice(params: {
    account: ArcaAccountRow;
    client: ReturnType<SupabaseService['getServiceRoleClient']>;
    existing: InvoiceRow;
    input: IssueInvoiceInput;
    ticket: Awaited<ReturnType<ArcaAuthService['getTicket']>>;
    userId: string;
    voucherType: VoucherTypeCode;
    voucherTypeCode: number;
  }): Promise<IssuedInvoiceResult> {
    const totals = computeTotals(params.input.lines);
    const issueDate = new Date().toISOString().slice(0, 10);
    const nextNumber = params.existing.voucher_number;
    if (!nextNumber) {
      throw new BadRequestException('La factura pendiente no tiene número de comprobante.');
    }

    await params.client
      .from('invoices')
      .update({
        created_by: params.userId,
        issue_date: issueDate,
        net_amount_cents: totals.netCents,
        vat_amount_cents: totals.vatCents,
        total_amount_cents: totals.totalCents,
        line_items: params.input.lines,
        customer_name: params.input.customerName ?? params.existing.customer_name,
        arca_status: 'pending',
        last_error: null,
      })
      .eq('id', params.existing.id);

    return this.authorizeDraftInvoice({
      account: params.account,
      client: params.client,
      input: params.input,
      invoiceId: params.existing.id,
      issueDate,
      nextNumber,
      ticket: params.ticket,
      totals,
      voucherType: params.voucherType,
      voucherTypeCode: params.voucherTypeCode,
    });
  }

  private async allocateVoucherNumber(params: {
    account: ArcaAccountRow;
    arcaLast: number;
    client: ReturnType<SupabaseService['getServiceRoleClient']>;
    ticket: Awaited<ReturnType<ArcaAuthService['getTicket']>>;
    voucherTypeCode: number;
  }): Promise<{ reuseInvoiceId?: string; voucherNumber: number }> {
    let nextNumber = params.arcaLast + 1;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { data, error } = await params.client
        .from('invoices')
        .select(
          'id, voucher_number, arca_status, sell_quote_id, cae, arca_response, customer_name',
        )
        .eq('organization_id', params.account.organization_id)
        .eq('point_of_sale', params.account.point_of_sale)
        .eq('voucher_type_code', params.voucherTypeCode)
        .eq('voucher_number', nextNumber)
        .maybeSingle();

      if (error) {
        throw new BadRequestException(error.message);
      }

      if (!data) {
        return { voucherNumber: nextNumber };
      }

      const existing = data as InvoiceRow;
      if (existing.arca_status === 'pending' || existing.arca_status === 'error') {
        return { reuseInvoiceId: existing.id, voucherNumber: nextNumber };
      }

      const mockLocal = isMockArcaResponse(existing.arca_response);

      // Local row claims this number. Confirm against ARCA before skipping.
      const consulted = await this.wsfe.consultComprobante({
        account: params.account,
        ticket: params.ticket,
        voucherTypeCode: params.voucherTypeCode,
        voucherNumber: nextNumber,
      });

      if (consulted.exists) {
        nextNumber += 1;
        continue;
      }

      // Stale mock/local-only row — free the ARCA sequence number.
      if (mockLocal || existing.arca_status !== 'authorized') {
        this.logger.warn(
          `Removing stale local invoice ${existing.id} for PV ${params.account.point_of_sale} #${nextNumber}`,
        );
        await params.client.from('invoices').delete().eq('id', existing.id);
        return { voucherNumber: nextNumber };
      }

      // Authorized locally but ARCA does not confirm — do not delete; advance locally.
      // (Can happen if consult failed transiently; AFIP may still reject a skipped number.)
      this.logger.warn(
        `Local authorized invoice ${existing.id} #${nextNumber} not found in ARCA; trying next number`,
      );
      nextNumber += 1;
    }

    throw new BadRequestException(
      'No se pudo asignar un número de comprobante libre. Revisá facturas pendientes.',
    );
  }

  private async findInvoiceForQuote(params: {
    client: ReturnType<SupabaseService['getServiceRoleClient']>;
    organizationId: string;
    sellQuoteId: string;
  }): Promise<InvoiceRow | null> {
    const { data, error } = await params.client
      .from('invoices')
      .select(
        'id, voucher_number, voucher_type, arca_status, sell_quote_id, cae, cae_expiration, qr_url, pdf_storage_path, total_amount_cents, customer_name, arca_response',
      )
      .eq('organization_id', params.organizationId)
      .eq('sell_quote_id', params.sellQuoteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data as InvoiceRow | null) ?? null;
  }

  private toIssuedResult(row: InvoiceRow, voucherType: VoucherTypeCode): IssuedInvoiceResult {
    return {
      cae: row.cae ?? null,
      caeExpiration: row.cae_expiration ?? null,
      id: row.id,
      pdfStoragePath: row.pdf_storage_path ?? null,
      qrUrl: row.qr_url ?? null,
      status: row.arca_status,
      totalAmountCents: row.total_amount_cents ?? 0,
      voucherNumber: row.voucher_number,
      voucherType: (row.voucher_type as VoucherTypeCode | undefined) ?? voucherType,
    };
  }

  async listInvoices(params: {
    authorizationHeader?: string;
    organizationId: string;
  }): Promise<unknown[]> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('invoices')
      .select(
        'id, voucher_type, voucher_number, point_of_sale, issue_date, total_amount_cents, arca_status, cae, cae_expiration, customer_name, qr_url, sell_quote_id, created_at',
      )
      .eq('organization_id', params.organizationId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data ?? [];
  }

  async getInvoice(params: {
    authorizationHeader?: string;
    invoiceId: string;
    organizationId: string;
  }): Promise<Record<string, unknown>> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('id', params.invoiceId)
      .eq('organization_id', params.organizationId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Factura no encontrada.');
    }

    const invoice = data as Record<string, unknown> & {
      arca_response?: { pdfBase64?: string; raw?: string };
      arca_status?: string;
      cae?: string | null;
      cae_expiration?: string | null;
      customer_document_number?: string | null;
      customer_document_type?: string | null;
      customer_name?: string | null;
      customer_tax_condition?: string | null;
      issue_date?: string;
      line_items?: Array<{
        description: string;
        quantity: number;
        unitPriceCents: number;
      }>;
      point_of_sale?: number;
      qr_url?: string | null;
      total_amount_cents?: number;
      voucher_number?: number | null;
      voucher_type?: VoucherTypeCode;
      voucher_type_code?: number;
    };

    let pdfBase64 = invoice.arca_response?.pdfBase64 ?? null;
    const storedTemplate = (invoice.arca_response as { pdfTemplate?: string } | undefined)
      ?.pdfTemplate;

    // Rebuild AFIP-style PDF for authorized invoices (also refreshes older stub PDFs).
    if (
      storedTemplate !== 'afip_v1' &&
      invoice.arca_status === 'authorized' &&
      invoice.cae &&
      invoice.qr_url &&
      invoice.voucher_number &&
      invoice.voucher_type &&
      invoice.voucher_type_code
    ) {
      try {
        const account = await this.connection.findAccount(params.organizationId);
        if (!account?.cuit) {
          throw new Error('Cuenta ARCA no encontrada para regenerar PDF.');
        }
        const org = await this.loadOrgFiscalProfile(params.organizationId);
        const lines = Array.isArray(invoice.line_items) ? invoice.line_items : [];
        const rebuilt = await this.pdf.buildPdf({
          businessName: org.legalName,
          cae: invoice.cae,
          caeExpiration: invoice.cae_expiration ?? String(invoice.issue_date ?? ''),
          cuit: account.cuit,
          customerDocumentNumber: invoice.customer_document_number,
          customerDocumentType: invoice.customer_document_type,
          customerName: invoice.customer_name ?? 'Consumidor final',
          customerTaxCondition:
            (invoice.customer_tax_condition as TaxCondition | null | undefined) ??
            'consumidor_final',
          emitterAddress: org.address,
          emitterTaxCondition: account.tax_condition,
          fantasyName: org.fantasyName,
          issueDate: String(invoice.issue_date ?? '').slice(0, 10),
          lines: lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            totalCents: Math.round(line.unitPriceCents * line.quantity),
            unitPriceCents: line.unitPriceCents,
          })),
          pointOfSale: Number(invoice.point_of_sale),
          qrUrl: invoice.qr_url,
          totalAmountCents: Number(invoice.total_amount_cents ?? 0),
          voucherNumber: invoice.voucher_number,
          voucherType: invoice.voucher_type,
          voucherTypeCode: invoice.voucher_type_code,
        });
        pdfBase64 = rebuilt.toString('base64');
        await client
          .from('invoices')
          .update({
            arca_response: {
              ...(invoice.arca_response ?? {}),
              pdfBase64,
              pdfTemplate: 'afip_v1',
            },
          })
          .eq('id', params.invoiceId);
      } catch (error) {
        this.logger.warn(
          `No se pudo regenerar PDF AFIP de ${params.invoiceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const { arca_response: _arcaResponse, ...rest } = invoice;
    return {
      ...rest,
      hasPdf: Boolean(pdfBase64),
      pdfBase64,
    };
  }

  private async loadOrgFiscalProfile(organizationId: string): Promise<{
    address: string | null;
    fantasyName: string | null;
    legalName: string;
  }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data } = await client
      .from('organizations')
      .select(
        'name, legal_name, fiscal_address_line1, fiscal_city, fiscal_province, fiscal_postal_code',
      )
      .eq('id', organizationId)
      .maybeSingle();

    const org = data as {
      fiscal_address_line1?: string | null;
      fiscal_city?: string | null;
      fiscal_postal_code?: string | null;
      fiscal_province?: string | null;
      legal_name?: string | null;
      name?: string | null;
    } | null;

    const addressParts = [
      org?.fiscal_address_line1,
      [org?.fiscal_postal_code, org?.fiscal_city].filter(Boolean).join(' '),
      org?.fiscal_province,
    ].filter((part) => Boolean(part && String(part).trim()));

    return {
      address: addressParts.length > 0 ? addressParts.join(', ') : null,
      fantasyName: org?.name?.trim() || null,
      legalName: org?.legal_name?.trim() || org?.name?.trim() || 'Negocio',
    };
  }

  private async acquireLock(params: {
    cuit: string;
    lockedBy: string;
    organizationId: string;
    pointOfSale: number;
    voucherTypeCode: number;
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const now = Date.now();
    const expiresAt = new Date(now + LOCK_TTL_MS).toISOString();

    // Clear expired locks first.
    await client
      .from('invoice_issuance_locks')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('point_of_sale', params.pointOfSale)
      .eq('voucher_type_code', params.voucherTypeCode)
      .lt('expires_at', new Date(now).toISOString());

    const { error } = await client.from('invoice_issuance_locks').insert({
      organization_id: params.organizationId,
      cuit: params.cuit,
      point_of_sale: params.pointOfSale,
      voucher_type_code: params.voucherTypeCode,
      locked_by: params.lockedBy,
      expires_at: expiresAt,
    });

    if (error) {
      throw new BadRequestException(
        'Hay otra emisión de factura en curso para este punto de venta. Reintentá en unos segundos.',
      );
    }
  }

  private async releaseLock(params: {
    lockedBy: string;
    organizationId: string;
    pointOfSale: number;
    voucherTypeCode: number;
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    await client
      .from('invoice_issuance_locks')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('point_of_sale', params.pointOfSale)
      .eq('voucher_type_code', params.voucherTypeCode)
      .eq('locked_by', params.lockedBy);
  }
}

function computeTotals(lines: IssueInvoiceInput['lines']): {
  netCents: number;
  totalCents: number;
  vatCents: number;
} {
  let totalCents = 0;
  let netCents = 0;
  let vatCents = 0;
  for (const line of lines) {
    const lineTotal = Math.round(line.unitPriceCents * line.quantity);
    totalCents += lineTotal;
    const net =
      line.ivaRate > 0 ? Math.round(lineTotal / (1 + line.ivaRate / 100)) : lineTotal;
    netCents += net;
    vatCents += lineTotal - net;
  }
  return { netCents, totalCents, vatCents };
}

function isMockArcaResponse(
  response: InvoiceRow['arca_response'] | Record<string, unknown> | null | undefined,
): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }
  if ((response as { mock?: boolean }).mock === true) {
    return true;
  }
  const raw = (response as { raw?: unknown }).raw;
  if (typeof raw === 'string' && raw.includes('"mock":true')) {
    return true;
  }
  return false;
}
