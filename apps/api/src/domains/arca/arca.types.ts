/** ARCA / AFIP voucher and tax domain types. */

export type ArcaEnvironment = 'homologacion' | 'production';

export type ArcaAuthorizationStatus =
  | 'pending'
  | 'connected'
  | 'error'
  | 'disabled'
  | 'awaiting_delegation';

export type TaxCondition =
  | 'monotributo'
  | 'responsable_inscripto'
  | 'exento'
  | 'no_responsable'
  | 'consumidor_final';

/** Nexolia voucher codes (letter). */
export type VoucherTypeCode =
  | 'FA'
  | 'FB'
  | 'FC'
  | 'NCA'
  | 'NCB'
  | 'NCC'
  | 'NDA'
  | 'NDB'
  | 'NDC';

/** AFIP WSFE CbteTipo numeric codes. */
export const AFIP_VOUCHER_TYPE_CODES: Record<VoucherTypeCode, number> = {
  FA: 1,
  FB: 6,
  FC: 11,
  NCA: 3,
  NCB: 8,
  NCC: 13,
  NDA: 2,
  NDB: 7,
  NDC: 12,
};

export const AFIP_DOC_TYPE_CODES: Record<string, number> = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  Pasaporte: 94,
  CI: 90,
  LC: 90,
  LE: 89,
  CF: 99,
};

export type ArcaAccountRow = {
  id: string;
  organization_id: string;
  cuit: string;
  tax_condition: TaxCondition;
  environment: ArcaEnvironment;
  point_of_sale: number;
  authorization_status: ArcaAuthorizationStatus;
  certificate_encrypted: string | null;
  private_key_encrypted: string | null;
  representation_metadata: Record<string, unknown>;
  wsaa_token_encrypted: string | null;
  wsaa_sign_encrypted: string | null;
  wsaa_token_expires_at: string | null;
  connected_at: string | null;
  last_error: string | null;
};

export type ArcaConnectionSummary = {
  authorizationStatus: ArcaAuthorizationStatus;
  connectedAt: string | null;
  cuit: string | null;
  environment: ArcaEnvironment;
  hasCredentials: boolean;
  lastError: string | null;
  pointOfSale: number | null;
  taxCondition: TaxCondition | null;
};

export type WsaaTicket = {
  expiresAt: Date;
  sign: string;
  token: string;
};

export type InvoiceLineInput = {
  description: string;
  ivaRate: number;
  quantity: number;
  unitPriceCents: number;
};

export type IssueInvoiceInput = {
  contactId?: string | null;
  customerDocumentNumber?: string | null;
  customerDocumentType?: string | null;
  customerName?: string | null;
  customerTaxCondition?: TaxCondition | null;
  lines: InvoiceLineInput[];
  organizationId: string;
  relatedInvoiceId?: string | null;
  sellQuoteId?: string | null;
  voucherType?: VoucherTypeCode;
};

export type IssuedInvoiceResult = {
  cae: string | null;
  caeExpiration: string | null;
  id: string;
  pdfStoragePath: string | null;
  qrUrl: string | null;
  status: string;
  totalAmountCents: number;
  voucherNumber: number | null;
  voucherType: VoucherTypeCode;
};

export function resolveVoucherType(
  emitterTaxCondition: TaxCondition,
  customerTaxCondition: TaxCondition | null | undefined,
  kind: 'factura' | 'nc' | 'nd' = 'factura',
): VoucherTypeCode {
  const prefix = kind === 'nc' ? 'NC' : kind === 'nd' ? 'ND' : 'F';

  if (emitterTaxCondition === 'monotributo' || emitterTaxCondition === 'exento') {
    return `${prefix}C` as VoucherTypeCode;
  }

  if (customerTaxCondition === 'responsable_inscripto') {
    return `${prefix}A` as VoucherTypeCode;
  }

  return `${prefix}B` as VoucherTypeCode;
}

export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, '');
}
