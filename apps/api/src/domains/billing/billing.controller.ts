import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { IssueInvoiceDto, IssuedInvoiceResponseDto } from '../../docs/openapi.dtos';
import type { TaxCondition, VoucherTypeCode } from '../arca/arca.types';
import { InvoiceService } from './invoice.service';

@ApiTags('Billing')
@ApiBearerAuth('SupabaseAuth')
@Controller('billing')
export class BillingController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post('invoices')
  @HttpCode(200)
  @ApiOperation({ summary: 'Issue an electronic invoice via ARCA (CAE)' })
  @ApiOkResponse({ type: IssuedInvoiceResponseDto })
  async issueInvoice(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: IssueInvoiceDto,
  ) {
    return this.invoiceService.issueInvoice({
      authorizationHeader,
      input: {
        organizationId: body.organizationId,
        sellQuoteId: body.sellQuoteId,
        contactId: body.contactId,
        voucherType: body.voucherType as VoucherTypeCode | undefined,
        customerName: body.customerName,
        customerDocumentType: body.customerDocumentType,
        customerDocumentNumber: body.customerDocumentNumber,
        customerTaxCondition: (body.customerTaxCondition as TaxCondition | undefined) ?? null,
        relatedInvoiceId: body.relatedInvoiceId,
        lines: body.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          ivaRate: line.ivaRate ?? 21,
        })),
      },
    });
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices for an organization' })
  async listInvoices(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('organizationId') organizationId: string,
  ) {
    return this.invoiceService.listInvoices({ authorizationHeader, organizationId });
  }

  @Get('invoices/:invoiceId')
  @ApiOperation({ summary: 'Get invoice detail including CAE and PDF' })
  async getInvoice(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('invoiceId') invoiceId: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.invoiceService.getInvoice({
      authorizationHeader,
      invoiceId,
      organizationId,
    });
  }
}
