import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { decryptSecret, encryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  normalizePlanSlug,
  planIncludesCopiPro,
} from '../organizations/organization-feature-flags.util';
import { OpenAiAdminClient } from './openai-admin.client';
import {
  defaultSpendLimitUsdForPlan,
  type OrganizationLlmCredentialRow,
  type OrganizationLlmCredentialStatusDto,
} from './organization-llm-credentials.types';

const CACHE_TTL_MS = 60_000;

@Injectable()
export class OrganizationLlmCredentialsService {
  private readonly logger = new Logger(OrganizationLlmCredentialsService.name);
  private readonly keyCache = new Map<string, { expiresAt: number; value: string }>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly openAiAdminClient: OpenAiAdminClient,
  ) {}

  async getStatus(organizationId: string): Promise<OrganizationLlmCredentialStatusDto> {
    const row = await this.findRow(organizationId);
    if (!row) {
      return {
        lastError: null,
        monthlySpendLimitUsd: null,
        openaiProjectId: null,
        provisionedAt: null,
        status: 'missing',
      };
    }

    return {
      lastError: row.last_error,
      monthlySpendLimitUsd:
        row.monthly_spend_limit_usd == null ? null : Number(row.monthly_spend_limit_usd),
      openaiProjectId: row.openai_project_id,
      provisionedAt: row.provisioned_at,
      status: row.status,
    };
  }

  /**
   * Dedicated encrypted key when active; otherwise shared OPENAI_API_KEY (may be empty).
   */
  async getApiKeyForOrganization(organizationId: string): Promise<string | null> {
    const cached = this.keyCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const row = await this.findRow(organizationId);
    if (row?.status === 'active' && row.api_key_encrypted) {
      try {
        const decrypted = decryptSecret(
          row.api_key_encrypted,
          process.env.BAAS_TOKEN_ENCRYPTION_KEY,
        ).trim();
        if (decrypted) {
          this.keyCache.set(organizationId, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            value: decrypted,
          });
          return decrypted;
        }
      } catch (error) {
        this.logger.error(
          `Failed to decrypt LLM key for org ${organizationId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const shared = process.env.OPENAI_API_KEY?.trim() || null;
    if (shared) {
      this.keyCache.set(organizationId, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: shared,
      });
    }
    return shared;
  }

  async provision(params: {
    actorUserId: string;
    organizationId: string;
  }): Promise<OrganizationLlmCredentialStatusDto> {
    if (!this.openAiAdminClient.isConfigured()) {
      throw new ServiceUnavailableException(
        'OPENAI_ADMIN_KEY no está configurada en el API. Agregala en Railway para provisionar claves.',
      );
    }

    if (!process.env.BAAS_TOKEN_ENCRYPTION_KEY?.trim()) {
      throw new ServiceUnavailableException(
        'BAAS_TOKEN_ENCRYPTION_KEY is required to store OpenAI keys.',
      );
    }

    const org = await this.loadOrgWithPlan(params.organizationId);
    if (!planIncludesCopiPro(org.planSlug)) {
      throw new BadRequestException(
        'Solo se pueden provisionar claves OpenAI para planes Pro o Enterprise.',
      );
    }

    const existing = await this.findRow(params.organizationId);
    if (existing?.status === 'active' && existing.api_key_encrypted) {
      return this.getStatus(params.organizationId);
    }

    const client = this.supabaseService.getServiceRoleClient();
    const spendLimitUsd = defaultSpendLimitUsdForPlan(org.planSlug);
    const projectName = `nexolia-${params.organizationId.replace(/-/g, '').slice(0, 20)}`;

    await client.from('organization_llm_credentials').upsert(
      {
        last_error: null,
        monthly_spend_limit_usd: spendLimitUsd,
        organization_id: params.organizationId,
        provider: 'openai',
        provisioned_by_user_id: params.actorUserId,
        status: 'pending',
      },
      { onConflict: 'organization_id,provider' },
    );

    try {
      const project = await this.openAiAdminClient.createProject(projectName);
      const serviceAccount = await this.openAiAdminClient.createProjectServiceAccount({
        name: 'copi-runtime',
        projectId: project.id,
      });
      const apiKeyValue = serviceAccount.api_key?.value?.trim();
      if (!apiKeyValue) {
        throw new Error('OpenAI did not return a service-account API key');
      }

      await this.openAiAdminClient.setProjectSpendLimit({
        projectId: project.id,
        thresholdUsd: spendLimitUsd,
      });

      const encrypted = encryptSecret(apiKeyValue, process.env.BAAS_TOKEN_ENCRYPTION_KEY);
      const { error } = await client
        .from('organization_llm_credentials')
        .update({
          api_key_encrypted: encrypted,
          last_error: null,
          monthly_spend_limit_usd: spendLimitUsd,
          openai_api_key_id: serviceAccount.api_key?.id ?? null,
          openai_project_id: project.id,
          openai_service_account_id: serviceAccount.id,
          provisioned_at: new Date().toISOString(),
          provisioned_by_user_id: params.actorUserId,
          status: 'active',
        })
        .eq('organization_id', params.organizationId)
        .eq('provider', 'openai');

      if (error) {
        throw new Error(error.message);
      }

      this.keyCache.delete(params.organizationId);
      this.logger.log(
        `Provisioned OpenAI project ${project.id} for org ${params.organizationId} (limit $${spendLimitUsd}/mo)`,
      );
      return this.getStatus(params.organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await client
        .from('organization_llm_credentials')
        .update({
          last_error: message.slice(0, 1000),
          status: 'failed',
        })
        .eq('organization_id', params.organizationId)
        .eq('provider', 'openai');
      this.logger.error(
        `OpenAI provision failed for org ${params.organizationId}: ${message}`,
      );
      throw new BadRequestException(
        `No se pudo provisionar la clave OpenAI: ${message.slice(0, 280)}`,
      );
    }
  }

  async revoke(params: {
    actorUserId: string;
    organizationId: string;
  }): Promise<OrganizationLlmCredentialStatusDto> {
    const row = await this.findRow(params.organizationId);
    if (!row || row.status === 'revoked') {
      return this.getStatus(params.organizationId);
    }

    if (row.openai_project_id && this.openAiAdminClient.isConfigured()) {
      await this.openAiAdminClient.archiveProject(row.openai_project_id);
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('organization_llm_credentials')
      .update({
        api_key_encrypted: null,
        last_error: null,
        provisioned_by_user_id: params.actorUserId,
        status: 'revoked',
      })
      .eq('organization_id', params.organizationId)
      .eq('provider', 'openai');

    if (error) {
      throw new BadRequestException(error.message);
    }

    this.keyCache.delete(params.organizationId);
    return this.getStatus(params.organizationId);
  }

  private async findRow(
    organizationId: string,
  ): Promise<OrganizationLlmCredentialRow | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_llm_credentials')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('provider', 'openai')
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to load LLM credentials for ${organizationId}: ${error.message}`,
      );
      return null;
    }

    return (data as OrganizationLlmCredentialRow | null) ?? null;
  }

  private async loadOrgWithPlan(
    organizationId: string,
  ): Promise<{ name: string; planSlug: string | null }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select('id, name, plan_id, plans(slug)')
      .eq('id', organizationId)
      .maybeSingle();

    if (error || !data) {
      throw new BadRequestException('Organización no encontrada');
    }

    const plans = data.plans as { slug?: string } | { slug?: string }[] | null;
    const planSlug = Array.isArray(plans)
      ? normalizePlanSlug(plans[0]?.slug)
      : normalizePlanSlug(plans?.slug);

    return {
      name: String(data.name ?? ''),
      planSlug: planSlug || null,
    };
  }
}
