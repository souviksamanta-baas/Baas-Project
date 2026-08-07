import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { decryptSecret, encryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { ArcaSoapClient, escapeXml } from './arca-soap.client';
import type { ArcaAccountRow, ArcaEnvironment, WsaaTicket } from './arca.types';

const WSAA_SERVICE = 'wsfe';
const TICKET_TTL_MS = 11 * 60 * 60 * 1000; // ~11h (ARCA tickets ~12h)
const AR_OFFSET = '-03:00';

@Injectable()
export class ArcaAuthService {
  private readonly logger = new Logger(ArcaAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly soap: ArcaSoapClient,
    private readonly supabaseService: SupabaseService,
  ) {}

  async getTicket(account: ArcaAccountRow): Promise<WsaaTicket> {
    const encryptionKey = this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY');
    const mockMode = this.soap.isMockMode();

    if (
      account.wsaa_token_encrypted &&
      account.wsaa_sign_encrypted &&
      account.wsaa_token_expires_at
    ) {
      const expiresAt = new Date(account.wsaa_token_expires_at);
      if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
        const token = decryptSecret(account.wsaa_token_encrypted, encryptionKey);
        const sign = decryptSecret(account.wsaa_sign_encrypted, encryptionKey);
        // Drop cached mock tickets once real certs are configured.
        if (!mockMode && isMockWsaaCredential(token, sign)) {
          this.logger.warn(
            `Discarding cached mock WSAA ticket for org ${account.organization_id}`,
          );
        } else if (mockMode || isPlausibleWsaaCredential(token, sign)) {
          return { expiresAt, sign, token };
        } else {
          this.logger.warn(
            `Discarding malformed cached WSAA ticket for org ${account.organization_id}`,
          );
        }
      }
    }

    const ticket = await this.loginCms(account);
    // Never persist mock tickets — they break WSFE once real mode is enabled.
    if (!mockMode) {
      await this.persistTicket(account.organization_id, ticket, encryptionKey);
    } else {
      await this.clearTicket(account.organization_id);
    }
    return ticket;
  }

  private async loginCms(account: ArcaAccountRow): Promise<WsaaTicket> {
    if (this.soap.isMockMode()) {
      const expiresAt = new Date(Date.now() + TICKET_TTL_MS);
      return {
        expiresAt,
        sign: `mock-sign-${account.cuit}`,
        token: `mock-token-${account.cuit}-${randomUUID()}`,
      };
    }

    const environment = this.soap.resolveEnvironment(account.environment);
    const { certPem, keyPem } = this.resolveCredentials(account);
    const tra = this.buildTraXml(environment);
    const cms = await this.signTra(tra, certPem, keyPem);

    const result = await this.soap.postSoap({
      url: this.soap.wsaaUrl(environment),
      action: 'http://wsaa.view.sua.servicios.afip.gov.ar/ILoginCMSService/loginCms',
      bodyXml: `<loginCms xmlns="http://wsaa.view.sua.servicios.afip.gov.ar/">
        <in0>${escapeXml(cms)}</in0>
      </loginCms>`,
    });

    const fault = this.soap.extractTag(result.body, 'faultstring');
    if (fault) {
      throw new BadRequestException(formatWsaaFault(fault));
    }

    if (!result.ok) {
      throw new BadRequestException(
        `ARCA WSAA respondió HTTP ${result.status}. Revisá el certificado y el servicio wsfe.`,
      );
    }

    const loginReturn = this.soap.extractTag(result.body, 'loginCmsReturn');
    if (!loginReturn) {
      throw new BadRequestException(
        'ARCA WSAA no devolvió credenciales. ¿El certificado está autorizado para Facturación Electrónica (wsfe)?',
      );
    }

    const credentialsXml = this.soap.decodeXmlEntities(loginReturn);
    const token = this.soap.extractTag(credentialsXml, 'token')?.replace(/\s+/g, '') ?? null;
    const sign = this.soap.extractTag(credentialsXml, 'sign')?.replace(/\s+/g, '') ?? null;
    const expirationTime = this.soap.extractTag(credentialsXml, 'expirationTime');

    if (!token || !sign) {
      throw new BadRequestException('ARCA WSAA no devolvió token/sign válidos.');
    }
    if (!isPlausibleWsaaCredential(token, sign)) {
      throw new BadRequestException('ARCA WSAA devolvió un token/sign inválido.');
    }

    return {
      expiresAt: expirationTime ? new Date(expirationTime) : new Date(Date.now() + TICKET_TTL_MS),
      sign,
      token,
    };
  }

  private resolveCredentials(account: ArcaAccountRow): { certPem: string; keyPem: string } {
    const encryptionKey = this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY');
    const orgCert = account.certificate_encrypted
      ? decryptSecret(account.certificate_encrypted, encryptionKey)
      : '';
    const orgKey = account.private_key_encrypted
      ? decryptSecret(account.private_key_encrypted, encryptionKey)
      : '';

    const platformCert = normalizePem(
      this.configService.get<string>('ARCA_PLATFORM_CERT_PEM') ?? '',
    );
    const platformKey = normalizePem(
      this.configService.get<string>('ARCA_PLATFORM_KEY_PEM') ?? '',
    );

    const certPem = normalizePem(orgCert) || platformCert;
    const keyPem = normalizePem(orgKey) || platformKey;

    if (!certPem || !keyPem) {
      throw new BadRequestException(
        'Falta el certificado/clave ARCA (ARCA_PLATFORM_CERT_PEM / ARCA_PLATFORM_KEY_PEM).',
      );
    }

    return { certPem, keyPem };
  }

  private buildTraXml(_environment: ArcaEnvironment): string {
    const uniqueId = Math.floor(Date.now() / 1000);
    // AFIP/ARCA expects local Argentina offset, not bare UTC.
    const generation = formatArcaDateTime(new Date(Date.now() - 10 * 60_000));
    const expiration = formatArcaDateTime(new Date(Date.now() + TICKET_TTL_MS));

    return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generation}</generationTime>
    <expirationTime>${expiration}</expirationTime>
  </header>
  <service>${WSAA_SERVICE}</service>
</loginTicketRequest>`;
  }

  /**
   * Sign TRA as CMS/PKCS#7. Prefer OpenSSL (AFIP-compatible); fall back to node-forge.
   */
  private async signTra(traXml: string, certPem: string, keyPem: string): Promise<string> {
    try {
      return await this.signTraWithOpenSsl(traXml, certPem, keyPem);
    } catch (opensslError) {
      this.logger.warn(
        `OpenSSL CMS sign failed (${opensslError instanceof Error ? opensslError.message : String(opensslError)}); trying node-forge`,
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const forge = require('node-forge') as typeof import('node-forge');
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(traXml, 'utf8');
      const cert = forge.pki.certificateFromPem(certPem);
      const key = forge.pki.privateKeyFromPem(keyPem);
      p7.addCertificate(cert);
      p7.addSigner({
        key,
        certificate: cert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
          { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
          { type: forge.pki.oids.messageDigest },
          { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
        ],
      });
      p7.sign({ detached: false });
      const asn1 = forge.asn1.toDer(p7.toAsn1()).getBytes();
      return forge.util.encode64(asn1);
    } catch (error) {
      this.logger.warn(
        `node-forge CMS sign failed (${error instanceof Error ? error.message : String(error)})`,
      );
      throw new BadRequestException(
        'No se pudo firmar el pedido WSAA. Verificá ARCA_PLATFORM_CERT_PEM / ARCA_PLATFORM_KEY_PEM.',
      );
    }
  }

  private async signTraWithOpenSsl(
    traXml: string,
    certPem: string,
    keyPem: string,
  ): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'arca-wsaa-'));
    try {
      const traPath = join(dir, 'tra.xml');
      const certPath = join(dir, 'cert.pem');
      const keyPath = join(dir, 'key.pem');
      const derPath = join(dir, 'tra.cms');
      await writeFile(traPath, traXml, 'utf8');
      await writeFile(certPath, certPem, 'utf8');
      await writeFile(keyPath, keyPem, 'utf8');

      await runCommand('openssl', [
        'cms',
        '-sign',
        '-in',
        traPath,
        '-signer',
        certPath,
        '-inkey',
        keyPath,
        '-nodetach',
        '-outform',
        'DER',
        '-out',
        derPath,
      ]);

      const der = await readFile(derPath);
      return der.toString('base64');
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  }

  private async persistTicket(
    organizationId: string,
    ticket: WsaaTicket,
    encryptionKey: string | undefined,
  ): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('arca_accounts')
      .update({
        wsaa_token_encrypted: encryptSecret(ticket.token, encryptionKey),
        wsaa_sign_encrypted: encryptSecret(ticket.sign, encryptionKey),
        wsaa_token_expires_at: ticket.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId);

    if (error) {
      this.logger.warn(`Failed to cache WSAA ticket: ${error.message}`);
    }
  }

  private async clearTicket(organizationId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    await client
      .from('arca_accounts')
      .update({
        wsaa_token_encrypted: null,
        wsaa_sign_encrypted: null,
        wsaa_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId);
  }

  /** Fingerprint for logging without exposing PEM. */
  certFingerprint(pem: string): string {
    return createHash('sha256').update(pem).digest('hex').slice(0, 16);
  }
}

function isMockWsaaCredential(token: string, sign: string): boolean {
  return token.startsWith('mock-token-') || sign.startsWith('mock-sign-');
}

function isPlausibleWsaaCredential(token: string, sign: string): boolean {
  if (!token || !sign || isMockWsaaCredential(token, sign)) {
    return false;
  }
  return isBase64Like(token) && isBase64Like(sign);
}

function isBase64Like(value: string): boolean {
  return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length >= 32;
}

function normalizePem(value: string): string {
  let pem = value.trim();
  if (
    (pem.startsWith('"') && pem.endsWith('"')) ||
    (pem.startsWith("'") && pem.endsWith("'"))
  ) {
    pem = pem.slice(1, -1);
  }
  return pem.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}

/** AFIP-style local datetime with fixed Argentina offset. */
function formatArcaDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${AR_OFFSET}`;
}

function formatWsaaFault(fault: string): string {
  const decoded = fault
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();

  if (/computador no autorizado/i.test(decoded)) {
    return (
      'ARCA: el certificado no está autorizado para el servicio wsfe. ' +
      'En ARCA (homologación), asociá el certificado al servicio Facturación Electrónica / wsfe y reintentá.'
    );
  }
  if (/generationTime/i.test(decoded)) {
    return `ARCA WSAA: fecha de generación inválida (${decoded}).`;
  }
  return `ARCA WSAA: ${decoded}`;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}
