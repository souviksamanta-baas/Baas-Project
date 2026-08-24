import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { assertOrgMembership, isOwnerOrCoOwner, resolveAuthUser } from '../../auth/request-auth.helper';
import { encryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ArcaAccountRow,
  ArcaAuthorizationStatus,
  ArcaConnectionSummary,
  ArcaEnvironment,
  TaxCondition,
} from './arca.types';
import { normalizeCuit } from './arca.types';

@Injectable()
export class ArcaConnectionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async getConnection(params: {
    authorizationHeader?: string;
    organizationId: string;
  }): Promise<ArcaConnectionSummary> {
    // Any org member can read connection status (needed to emit invoices from cobro).
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    const account = await this.findAccount(params.organizationId);
    return this.toSummary(account);
  }

  async upsertConnection(params: {
    authorizationHeader?: string;
    certificatePem?: string | null;
    cuit: string;
    environment?: ArcaEnvironment;
    organizationId: string;
    pointOfSale: number;
    privateKeyPem?: string | null;
    taxCondition: TaxCondition;
  }): Promise<ArcaConnectionSummary> {
    await this.requireOwner(params);

    const cuit = normalizeCuit(params.cuit);
    if (cuit.length !== 11) {
      throw new BadRequestException('CUIT inválido. Debe tener 11 dígitos.');
    }
    if (!Number.isInteger(params.pointOfSale) || params.pointOfSale < 1) {
      throw new BadRequestException('Punto de venta inválido.');
    }

    const encryptionKey = this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY');
    const environment = params.environment ?? 'homologacion';
    const hasOwnCert = Boolean(params.certificatePem?.trim() && params.privateKeyPem?.trim());

    // Homologación (and org-owned certs) can connect immediately.
    // Production via Nexolia representation requires Administrador de Relaciones confirmation.
    let authorizationStatus: ArcaAuthorizationStatus = 'awaiting_delegation';
    if (hasOwnCert || environment === 'homologacion') {
      authorizationStatus = 'connected';
    }

    const client = this.supabaseService.getServiceRoleClient();
    const payload: Record<string, unknown> = {
      organization_id: params.organizationId,
      cuit,
      tax_condition: params.taxCondition,
      environment,
      point_of_sale: params.pointOfSale,
      authorization_status: authorizationStatus,
      connected_at: authorizationStatus === 'connected' ? new Date().toISOString() : null,
      last_error: null,
      updated_at: new Date().toISOString(),
    };

    if (params.certificatePem?.trim()) {
      payload.certificate_encrypted = encryptSecret(params.certificatePem.trim(), encryptionKey);
    }
    if (params.privateKeyPem?.trim()) {
      payload.private_key_encrypted = encryptSecret(params.privateKeyPem.trim(), encryptionKey);
    }

    payload.representation_metadata = {
      onboarding: {
        steps: [
          'Ingresá a ARCA con tu Clave Fiscal',
          'Abrí Administrador de Relaciones de Clave Fiscal',
          'Buscá y autorizá a Nexolia como representante de Web Services (WSFE)',
          'Creá un Punto de Venta dedicado a Web Services (no compartas el de otro sistema)',
          'Volvé a Nexolia y confirmá la autorización',
        ],
        mode: hasOwnCert ? 'org_certificate' : 'nexolia_representation',
        environment,
        note:
          environment === 'production'
            ? 'En producción Nexolia opera con certificado de plataforma. No cargues ni compartas tu Clave Fiscal.'
            : 'Homologación usa ambiente de prueba ARCA. Podés emitir facturas de prueba sin autorización de producción.',
      },
    };

    const { data, error } = await client
      .from('arca_accounts')
      .upsert(payload, { onConflict: 'organization_id' })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    // Keep org emitter fields in sync for invoice PDFs / UI.
    await client
      .from('organizations')
      .update({
        cuit,
        tax_condition: params.taxCondition,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.organizationId);

    return this.toSummary(data as ArcaAccountRow);
  }

  async markConnected(params: {
    authorizationHeader?: string;
    organizationId: string;
  }): Promise<ArcaConnectionSummary> {
    await this.requireOwner(params);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('arca_accounts')
      .update({
        authorization_status: 'connected',
        connected_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', params.organizationId)
      .select('*')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toSummary(data as ArcaAccountRow);
  }

  async requireConnectedAccount(organizationId: string): Promise<ArcaAccountRow> {
    const account = await this.findAccount(organizationId);
    if (!account) {
      throw new BadRequestException('ARCA no está configurado para este negocio.');
    }
    if (account.authorization_status !== 'connected') {
      throw new BadRequestException(
        `ARCA no está listo (estado: ${account.authorization_status}). Completá la autorización.`,
      );
    }
    return account;
  }

  async findAccount(organizationId: string): Promise<ArcaAccountRow | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('arca_accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data as ArcaAccountRow | null) ?? null;
  }

  private toSummary(account: ArcaAccountRow | null): ArcaConnectionSummary {
    if (!account) {
      return {
        authorizationStatus: 'pending',
        connectedAt: null,
        cuit: null,
        environment: 'homologacion',
        hasCredentials: false,
        lastError: null,
        pointOfSale: null,
        taxCondition: null,
      };
    }

    return {
      authorizationStatus: account.authorization_status,
      connectedAt: account.connected_at,
      cuit: account.cuit,
      environment: account.environment,
      hasCredentials: Boolean(account.certificate_encrypted) || account.authorization_status === 'connected',
      lastError: account.last_error,
      pointOfSale: account.point_of_sale,
      taxCondition: account.tax_condition,
    };
  }

  private async requireOwner(params: {
    authorizationHeader?: string;
    organizationId: string;
  }): Promise<string> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    if (!isOwnerOrCoOwner(role)) {
      throw new ForbiddenException('Solo el dueño o un co-dueño puede configurar Facturación ARCA.');
    }
    return user.id;
  }
}
