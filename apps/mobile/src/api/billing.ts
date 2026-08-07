import { apiFetchAuthJson } from './client';

export type InvoiceVoucherType =
  | 'FA'
  | 'FB'
  | 'FC'
  | 'NCA'
  | 'NCB'
  | 'NCC'
  | 'NDA'
  | 'NDB'
  | 'NDC';

export type IssuedInvoice = {
  cae: string | null;
  caeExpiration: string | null;
  id: string;
  pdfStoragePath: string | null;
  qrUrl: string | null;
  status: string;
  totalAmountCents: number;
  voucherNumber: number | null;
  voucherType: InvoiceVoucherType;
};

export type InvoiceListItem = {
  arca_status: string;
  cae: string | null;
  cae_expiration: string | null;
  created_at: string;
  customer_name: string | null;
  id: string;
  issue_date: string;
  point_of_sale: number;
  qr_url: string | null;
  sell_quote_id: string | null;
  total_amount_cents: number;
  voucher_number: number | null;
  voucher_type: InvoiceVoucherType;
};

export type InvoiceDetail = InvoiceListItem & {
  customer_document_number?: string | null;
  customer_document_type?: string | null;
  hasPdf?: boolean;
  line_items?: unknown;
  pdfBase64?: string | null;
};

export async function issueInvoice(params: {
  customerDocumentNumber?: string;
  customerDocumentType?: string;
  customerName?: string;
  customerTaxCondition?: string;
  lines: Array<{
    description: string;
    ivaRate?: number;
    quantity: number;
    unitPriceCents: number;
  }>;
  organizationId: string;
  sellQuoteId?: string;
  voucherType?: InvoiceVoucherType;
}): Promise<IssuedInvoice> {
  return apiFetchAuthJson<IssuedInvoice>('/billing/invoices', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function listInvoices(organizationId: string): Promise<InvoiceListItem[]> {
  const query = new URLSearchParams({ organizationId });
  return apiFetchAuthJson<InvoiceListItem[]>(`/billing/invoices?${query.toString()}`);
}

export async function getInvoice(params: {
  invoiceId: string;
  organizationId: string;
}): Promise<InvoiceDetail> {
  const query = new URLSearchParams({ organizationId: params.organizationId });
  return apiFetchAuthJson<InvoiceDetail>(
    `/billing/invoices/${params.invoiceId}?${query.toString()}`,
  );
}
