import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ArcaEnvironment, WsaaTicket } from './arca.types';

type SoapCallResult = {
  body: string;
  ok: boolean;
  status: number;
};

/**
 * Low-level SOAP transport for ARCA WSAA / WSFEv1.
 * All XML lives here — domain services never build envelopes.
 */
@Injectable()
export class ArcaSoapClient {
  private readonly logger = new Logger(ArcaSoapClient.name);

  constructor(private readonly configService: ConfigService) {}

  isMockMode(): boolean {
    const flag = (this.configService.get<string>('ARCA_MOCK') ?? '').trim().toLowerCase();
    if (flag === 'true' || flag === '1') {
      return true;
    }
    if (flag === 'false' || flag === '0') {
      return false;
    }
    // Default mock when no platform cert configured.
    const cert = (this.configService.get<string>('ARCA_PLATFORM_CERT_PEM') ?? '').trim();
    return !cert;
  }

  resolveEnvironment(preferred?: ArcaEnvironment): ArcaEnvironment {
    if (preferred) {
      return preferred;
    }
    const env = (this.configService.get<string>('ARCA_ENV') ?? 'homologacion').trim();
    return env === 'production' ? 'production' : 'homologacion';
  }

  wsaaUrl(environment: ArcaEnvironment): string {
    const override = (this.configService.get<string>('ARCA_WSAA_URL') ?? '').trim();
    if (override) {
      return override;
    }
    return environment === 'production'
      ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
      : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';
  }

  wsfeUrl(environment: ArcaEnvironment): string {
    const override = (this.configService.get<string>('ARCA_WSFE_URL') ?? '').trim();
    if (override) {
      return override;
    }
    return environment === 'production'
      ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
      : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
  }

  async postSoap(params: {
    action: string;
    bodyXml: string;
    url: string;
  }): Promise<SoapCallResult> {
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    ${params.bodyXml}
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await fetch(params.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: params.action,
        },
        body: envelope,
      });
      const body = await response.text();
      return { body, ok: response.ok, status: response.status };
    } catch (error) {
      this.logger.error(`SOAP call failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  extractTag(xml: string, tag: string): string | null {
    const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'i');
    const match = xml.match(re);
    return match?.[1]?.trim() ?? null;
  }

  decodeXmlEntities(value: string): string {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  /** Build FEAuth XML fragment for WSFE calls. */
  feAuthXml(ticket: WsaaTicket, cuit: string): string {
    return `<Auth>
      <Token>${escapeXml(ticket.token)}</Token>
      <Sign>${escapeXml(ticket.sign)}</Sign>
      <Cuit>${escapeXml(cuit)}</Cuit>
    </Auth>`;
  }
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
