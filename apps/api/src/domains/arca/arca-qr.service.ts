import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ArcaQrService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Build ARCA electronic invoice QR URL.
   * Payload is base64 JSON per ARCA QR spec.
   */
  buildQrUrl(params: {
    cae: string;
    cuit: string;
    currency: string;
    customerDocumentNumber: string | null;
    customerDocumentTypeCode: number;
    issueDate: string;
    pointOfSale: number;
    totalAmount: number;
    voucherNumber: number;
    voucherTypeCode: number;
  }): string {
    const base =
      (this.configService.get<string>('ARCA_QR_BASE_URL') ?? '').trim() ||
      'https://www.afip.gob.ar/fe/qr/';

    const payload = {
      ver: 1,
      fecha: params.issueDate,
      cuit: Number.parseInt(params.cuit.replace(/\D/g, ''), 10),
      ptoVta: params.pointOfSale,
      tipoCmp: params.voucherTypeCode,
      nroCmp: params.voucherNumber,
      importe: Number(params.totalAmount.toFixed(2)),
      moneda: params.currency === 'ARS' ? 'PES' : params.currency,
      ctz: 1,
      tipoDocRec: params.customerDocumentTypeCode,
      nroDocRec: Number.parseInt(
        (params.customerDocumentNumber ?? '0').replace(/\D/g, '') || '0',
        10,
      ),
      tipoCodAut: 'E',
      codAut: Number.parseInt(params.cae.replace(/\D/g, ''), 10) || 0,
    };

    const json = JSON.stringify(payload);
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    return `${base}?p=${encodeURIComponent(b64)}`;
  }

  /** Deterministic short id for storage paths. */
  invoiceFileKey(invoiceId: string): string {
    return createHash('sha256').update(invoiceId).digest('hex').slice(0, 24);
  }
}
