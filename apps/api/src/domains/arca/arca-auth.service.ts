import { createHash, randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { decryptSecret, encryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { ArcaSoapClient, escapeXml } from './arca-soap.client';
import type { ArcaAccountRow, ArcaEnvironment, WsaaTicket } from './arca.types';

const WSAA_SERVICE = 'wsfe';
const TICKET_TTL_MS = 11 * 60 * 60 * 1000; // ~11h (ARCA tickets ~12h)

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

    if (!result.ok) {
      throw new Error(`WSAA loginCms HTTP ${result.status}`);
    }

    const loginReturn = this.soap.extractTag(result.body, 'loginCmsReturn');
    if (!loginReturn) {
      throw new Error('WSAA response missing loginCmsReturn');
    }

    const credentialsXml = this.soap.decodeXmlEntities(loginReturn);
    const token = this.soap.extractTag(credentialsXml, 'token')?.replace(/\s+/g, '') ?? null;
    const sign = this.soap.extractTag(credentialsXml, 'sign')?.replace(/\s+/g, '') ?? null;
    const expirationTime = this.soap.extractTag(credentialsXml, 'expirationTime');

    if (!token || !sign) {
      throw new Error('WSAA credentials missing token/sign');
    }
    if (!isPlausibleWsaaCredential(token, sign)) {
      throw new Error('WSAA returned a token/sign that is not valid Base64');
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
      throw new Error('ARCA certificate/private key not configured');
    }

    return { certPem, keyPem };
  }

  private buildTraXml(environment: ArcaEnvironment): string {
    const uniqueId = Math.floor(Date.now() / 1000);
    const generation = new Date(Date.now() - 60_000).toISOString().replace(/\.\d{3}Z$/, '');
    const expiration = new Date(Date.now() + TICKET_TTL_MS).toISOString().replace(/\.\d{3}Z$/, '');

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
   * Sign TRA as CMS/PKCS#7. Uses node-forge when available; otherwise OpenSSL CLI.
   */
  private async signTra(traXml: string, certPem: string, keyPem: string): Promise<string> {
    try {
      // Dynamic require keeps typecheck green if node-forge is optional in some envs.
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
          { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
        ],
      });
      p7.sign({ detached: false });
      const asn1 = forge.asn1.toDer(p7.toAsn1()).getBytes();
      return forge.util.encode64(asn1);
    } catch (error) {
      this.logger.warn(
        `node-forge CMS sign failed (${error instanceof Error ? error.message : String(error)}); falling back to hash stub is not allowed for production.`,
      );
      throw new Error(
        'Unable to sign WSAA TRA. Install node-forge and configure ARCA_PLATFORM_CERT_PEM / ARCA_PLATFORM_KEY_PEM.',
      );
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
  // AFIP tokens/signs are Base64; reject obvious garbage early.
  return isBase64Like(token) && isBase64Like(sign);
}

function isBase64Like(value: string): boolean {
  return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length >= 32;
}

/** Normalize PEM from Railway/env (literal \\n, wrapping quotes, stray CR). */
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
