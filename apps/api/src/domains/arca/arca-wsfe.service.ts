import { Injectable, Logger } from '@nestjs/common';

import { ArcaSoapClient, escapeXml } from './arca-soap.client';
import type { ArcaAccountRow, InvoiceLineInput, WsaaTicket } from './arca.types';
import { AFIP_DOC_TYPE_CODES } from './arca.types';

export type FeCaeResult = {
  cae: string;
  caeExpiration: string;
  observations?: string[];
  raw: string;
  rejected: boolean;
  rejectionReason?: string;
  voucherNumber: number;
};

export type FeCompConsultResult = {
  cae: string | null;
  caeExpiration: string | null;
  exists: boolean;
  raw: string;
  voucherNumber: number | null;
};

@Injectable()
export class ArcaWsfeService {
  private readonly logger = new Logger(ArcaWsfeService.name);

  constructor(private readonly soap: ArcaSoapClient) {}

  async getLastAuthorizedNumber(params: {
    account: ArcaAccountRow;
    ticket: WsaaTicket;
    voucherTypeCode: number;
  }): Promise<number> {
    if (this.soap.isMockMode()) {
      return 0;
    }

    const environment = this.soap.resolveEnvironment(params.account.environment);
    const bodyXml = `<FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
      ${this.soap.feAuthXml(params.ticket, params.account.cuit)}
      <PtoVta>${params.account.point_of_sale}</PtoVta>
      <CbteTipo>${params.voucherTypeCode}</CbteTipo>
    </FECompUltimoAutorizado>`;

    const result = await this.soap.postSoap({
      url: this.soap.wsfeUrl(environment),
      action: 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
      bodyXml,
    });

    if (!result.ok) {
      throw new Error(`FECompUltimoAutorizado HTTP ${result.status}`);
    }

    const cbteNro = this.soap.extractTag(result.body, 'CbteNro');
    return cbteNro ? Number.parseInt(cbteNro, 10) || 0 : 0;
  }

  async requestCae(params: {
    account: ArcaAccountRow;
    customerDocumentNumber: string | null;
    customerDocumentType: string | null;
    issueDate: string;
    lines: InvoiceLineInput[];
    ticket: WsaaTicket;
    totalCents: number;
    voucherNumber: number;
    voucherTypeCode: number;
  }): Promise<FeCaeResult> {
    if (this.soap.isMockMode()) {
      const cae = String(Math.floor(10_000_000_000_000 + Math.random() * 89_000_000_000_000));
      const exp = new Date();
      exp.setDate(exp.getDate() + 10);
      return {
        cae,
        caeExpiration: exp.toISOString().slice(0, 10),
        raw: JSON.stringify({ mock: true, voucherNumber: params.voucherNumber }),
        rejected: false,
        voucherNumber: params.voucherNumber,
      };
    }

    const environment = this.soap.resolveEnvironment(params.account.environment);
    const docTipo =
      AFIP_DOC_TYPE_CODES[params.customerDocumentType ?? 'CF'] ?? AFIP_DOC_TYPE_CODES.CF;
    const docNro = (params.customerDocumentNumber ?? '0').replace(/\D/g, '') || '0';
    const impTotal = (params.totalCents / 100).toFixed(2);
    const { net, iva, ivaDetails } = summarizeIva(params.lines);
    const cbteFch = params.issueDate.replace(/-/g, '');

    const ivaXml =
      ivaDetails.length > 0
        ? `<Iva>${ivaDetails
            .map(
              (row) => `<AlicIva>
            <Id>${row.id}</Id>
            <BaseImp>${row.base}</BaseImp>
            <Importe>${row.importe}</Importe>
          </AlicIva>`,
            )
            .join('')}</Iva>`
        : '';

    const bodyXml = `<FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      ${this.soap.feAuthXml(params.ticket, params.account.cuit)}
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${params.account.point_of_sale}</PtoVta>
          <CbteTipo>${params.voucherTypeCode}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>${docTipo}</DocTipo>
            <DocNro>${escapeXml(docNro)}</DocNro>
            <CbteDesde>${params.voucherNumber}</CbteDesde>
            <CbteHasta>${params.voucherNumber}</CbteHasta>
            <CbteFch>${cbteFch}</CbteFch>
            <ImpTotal>${impTotal}</ImpTotal>
            <ImpTotConc>0</ImpTotConc>
            <ImpNeto>${net}</ImpNeto>
            <ImpOpEx>0</ImpOpEx>
            <ImpIVA>${iva}</ImpIVA>
            <ImpTrib>0</ImpTrib>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            ${ivaXml}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>`;

    const result = await this.soap.postSoap({
      url: this.soap.wsfeUrl(environment),
      action: 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
      bodyXml,
    });

    const cae = this.soap.extractTag(result.body, 'CAE');
    const caeFchVto = this.soap.extractTag(result.body, 'CAEFchVto');
    const resultado = this.soap.extractTag(result.body, 'Resultado');
    const obs = this.soap.extractTag(result.body, 'Msg');

    if (!result.ok || resultado === 'R' || !cae) {
      return {
        cae: cae ?? '',
        caeExpiration: formatAfipDate(caeFchVto),
        observations: obs ? [obs] : undefined,
        raw: result.body,
        rejected: true,
        rejectionReason: obs ?? `FECAESolicitar failed (HTTP ${result.status}, Resultado=${resultado})`,
        voucherNumber: params.voucherNumber,
      };
    }

    return {
      cae,
      caeExpiration: formatAfipDate(caeFchVto),
      observations: obs ? [obs] : undefined,
      raw: result.body,
      rejected: false,
      voucherNumber: params.voucherNumber,
    };
  }

  async consultComprobante(params: {
    account: ArcaAccountRow;
    ticket: WsaaTicket;
    voucherNumber: number;
    voucherTypeCode: number;
  }): Promise<FeCompConsultResult> {
    if (this.soap.isMockMode()) {
      return { cae: null, caeExpiration: null, exists: false, raw: '', voucherNumber: null };
    }

    const environment = this.soap.resolveEnvironment(params.account.environment);
    const bodyXml = `<FECompConsultar xmlns="http://ar.gov.afip.dif.FEV1/">
      ${this.soap.feAuthXml(params.ticket, params.account.cuit)}
      <FeCompConsReq>
        <CbteTipo>${params.voucherTypeCode}</CbteTipo>
        <CbteNro>${params.voucherNumber}</CbteNro>
        <PtoVta>${params.account.point_of_sale}</PtoVta>
      </FeCompConsReq>
    </FECompConsultar>`;

    try {
      const result = await this.soap.postSoap({
        url: this.soap.wsfeUrl(environment),
        action: 'http://ar.gov.afip.dif.FEV1/FECompConsultar',
        bodyXml,
      });

      const cae = this.soap.extractTag(result.body, 'CodAutorizacion');
      const caeFchVto = this.soap.extractTag(result.body, 'FchVto');
      const cbteNro = this.soap.extractTag(result.body, 'CbteDesde');

      if (!cae) {
        return { cae: null, caeExpiration: null, exists: false, raw: result.body, voucherNumber: null };
      }

      return {
        cae,
        caeExpiration: formatAfipDate(caeFchVto),
        exists: true,
        raw: result.body,
        voucherNumber: cbteNro ? Number.parseInt(cbteNro, 10) : params.voucherNumber,
      };
    } catch (error) {
      this.logger.warn(
        `FECompConsultar failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { cae: null, caeExpiration: null, exists: false, raw: '', voucherNumber: null };
    }
  }
}

function formatAfipDate(value: string | null): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value.slice(0, 10);
}

function summarizeIva(lines: InvoiceLineInput[]): {
  iva: string;
  ivaDetails: Array<{ base: string; id: number; importe: string }>;
  net: string;
} {
  const byRate = new Map<number, { baseCents: number; ivaCents: number }>();
  let netCents = 0;
  let ivaCents = 0;

  for (const line of lines) {
    const lineTotal = Math.round(line.unitPriceCents * line.quantity);
    const rate = line.ivaRate;
    // Treat unit prices as tax-included for C; for A/B split.
    const net = rate > 0 ? Math.round(lineTotal / (1 + rate / 100)) : lineTotal;
    const iva = lineTotal - net;
    netCents += net;
    ivaCents += iva;
    const current = byRate.get(rate) ?? { baseCents: 0, ivaCents: 0 };
    current.baseCents += net;
    current.ivaCents += iva;
    byRate.set(rate, current);
  }

  const idByRate: Record<number, number> = { 0: 3, 10.5: 4, 21: 5, 27: 6 };
  const ivaDetails = [...byRate.entries()]
    .filter(([rate]) => rate > 0)
    .map(([rate, amounts]) => ({
      id: idByRate[rate] ?? 5,
      base: (amounts.baseCents / 100).toFixed(2),
      importe: (amounts.ivaCents / 100).toFixed(2),
    }));

  return {
    net: (netCents / 100).toFixed(2),
    iva: (ivaCents / 100).toFixed(2),
    ivaDetails,
  };
}
