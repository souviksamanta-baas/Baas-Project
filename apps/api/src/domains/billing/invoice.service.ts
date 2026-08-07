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
  type IssuedInvoiceResult,
  type IssueInvoiceInput,
  type VoucherTypeCode,
  resolveVoucherType,
} from '../arca/arca.types';

const LOCK_TTL_MS = 60_000;
const VOUCHER_LABELS: Record<VoucherTypeCode, string> = {
  FA: 'Factura A',
  FB: 'Factura B',
  FC: 'Factura C',
  NCA: 'Nota de Crédito A',
  NCB: 'Nota de Crédito B',
  NCC: 'Nota de Crédito C',
  NDA: 'Nota de Débito A',
  NDB: 'Nota de Débito B',
  NDC: 'Nota de Débito C',
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
      const ticket = await this.auth.getTicket(account);
      let lastNumber = await this.wsfe.getLastAuthorizedNumber({
        account,
        ticket,
        voucherTypeCode,
      });
      let nextNumber = lastNumber + 1;

      const totals = computeTotals(params.input.lines);
      const issueDate = new Date().toISOString().slice(0, 10);
      const client = this.supabaseService.getServiceRoleClient();

      const { data: draft, error: insertError } = await client
        .from('invoices')
        .insert({
          organization_id: account.organization_id,
          sell_quote_id: params.input.sellQuoteId ?? null,
          contact_id: params.input.contactId ?? null,
          created_by: user.id,
          voucher_type: voucherType,
          voucher_type_code: voucherTypeCode,
          point_of_sale: account.point_of_sale,
          voucher_number: nextNumber,
          issue_date: issueDate,
          net_amount_cents: totals.netCents,
          vat_amount_cents: totals.vatCents,
          exempt_amount_cents: 0,
          total_amount_cents: totals.totalCents,
          customer_document_type: params.input.customerDocumentType ?? 'CF',
          customer_document_number: params.input.customerDocumentNumber ?? '0',
          customer_tax_condition: params.input.customerTaxCondition ?? 'consumidor_final',
          customer_name: params.input.customerName ?? 'Consumidor final',
          line_items: params.input.lines,
          related_invoice_id: params.input.relatedInvoiceId ?? null,
          arca_status: 'pending',
        })
        .select('id')
        .single();

      if (insertError || !draft) {
        throw new BadRequestException(insertError?.message ?? 'No se pudo crear el borrador de factura.');
      }

      const invoiceId = draft.id as string;
      let caeResult;

      try {
        caeResult = await this.wsfe.requestCae({
          account,
          ticket,
          voucherTypeCode,
          voucherNumber: nextNumber,
          issueDate,
          lines: params.input.lines,
          totalCents: totals.totalCents,
          customerDocumentType: params.input.customerDocumentType ?? 'CF',
          customerDocumentNumber: params.input.customerDocumentNumber ?? '0',
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
        AFIP_DOC_TYPE_CODES[params.input.customerDocumentType ?? 'CF'] ?? AFIP_DOC_TYPE_CODES.CF;
      const qrUrl = this.qr.buildQrUrl({
        cae: caeResult.cae,
        cuit: account.cuit,
        currency: 'ARS',
        customerDocumentNumber: params.input.customerDocumentNumber ?? '0',
        customerDocumentTypeCode: docTypeCode,
        issueDate,
        pointOfSale: account.point_of_sale,
        totalAmount: totals.totalCents / 100,
        voucherNumber: nextNumber,
        voucherTypeCode,
      });

      const orgName = await this.loadOrgName(account.organization_id);
      const pdfBuffer = this.pdf.buildPdf({
        businessName: orgName,
        cae: caeResult.cae,
        caeExpiration: caeResult.caeExpiration,
        cuit: account.cuit,
        customerName: params.input.customerName ?? 'Consumidor final',
        issueDate,
        lines: params.input.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          totalCents: Math.round(line.unitPriceCents * line.quantity),
        })),
        pointOfSale: account.point_of_sale,
        qrUrl,
        totalAmountCents: totals.totalCents,
        voucherNumber: nextNumber,
        voucherTypeLabel: VOUCHER_LABELS[voucherType],
      });

      const pdfPath = `invoices/${account.organization_id}/${this.qr.invoiceFileKey(invoiceId)}.pdf`;
      // Store PDF as base64 in response metadata when storage bucket is unavailable.
      const pdfBase64 = pdfBuffer.toString('base64');

      const { error: updateError } = await client
        .from('invoices')
        .update({
          arca_status: 'authorized',
          cae: caeResult.cae,
          cae_expiration: caeResult.caeExpiration,
          qr_url: qrUrl,
          pdf_storage_path: pdfPath,
          arca_response: { raw: caeResult.raw, pdfBase64 },
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
    } finally {
      await this.releaseLock({
        organizationId: account.organization_id,
        pointOfSale: account.point_of_sale,
        voucherTypeCode,
        lockedBy: lockId,
      });
    }
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

    // Strip bulky pdf base64 from default payload unless needed — keep qr/cae.
    const { arca_response, ...rest } = data as Record<string, unknown> & {
      arca_response?: { pdfBase64?: string; raw?: string };
    };
    return {
      ...rest,
      hasPdf: Boolean(arca_response?.pdfBase64),
      pdfBase64: arca_response?.pdfBase64 ?? null,
    };
  }

  private async loadOrgName(organizationId: string): Promise<string> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data } = await client
      .from('organizations')
      .select('name, legal_name')
      .eq('id', organizationId)
      .maybeSingle();
    return (
      (data as { legal_name?: string | null; name?: string } | null)?.legal_name?.trim() ||
      (data as { name?: string } | null)?.name ||
      'Negocio'
    );
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
