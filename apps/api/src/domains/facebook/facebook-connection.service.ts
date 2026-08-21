import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveAuthUser, assertOrgMembership } from '../../auth/request-auth.helper';
import { encryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { FacebookConnectionSummary } from './facebook-connection.types';

export type { FacebookConnectionSummary } from './facebook-connection.types';

@Injectable()
export class FacebookConnectionService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /** @deprecated Prefer FacebookOAuthService — kept for emergency/manual ops. */
  async registerConnection(params: {
    accessToken: string;
    authorizationHeader: string | undefined;
    organizationId: string;
    pageId: string;
    pageName?: string;
  }): Promise<FacebookConnectionSummary> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    if (role !== 'owner') {
      throw new Error('Only organization owners can register Facebook connections');
    }

    const businessCenterId = await this.getDefaultBusinessCenterId(params.organizationId);
    const verifiedAt = new Date().toISOString();
    const client = this.supabaseService.getServiceRoleClient();
    const encrypted = encryptSecret(
      params.accessToken.trim(),
      this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY'),
    );

    const { data, error } = await client
      .from('facebook_config')
      .upsert(
        {
          organization_id: params.organizationId,
          business_center_id: businessCenterId,
          page_id: params.pageId.trim(),
          page_name: params.pageName?.trim() || null,
          access_token_encrypted: encrypted,
          connection_status: 'connected',
          verified_at: verifiedAt,
          last_status_check_at: verifiedAt,
          last_error: null,
        },
        { onConflict: 'organization_id,business_center_id' },
      )
      .select(
        'page_id, page_name, connection_status, verified_at, last_status_check_at, last_error, token_expires_at',
      )
      .single();

    if (error) {
      throw new Error(`Failed to register Facebook connection: ${error.message}`);
    }

    return {
      lastError: data.last_error,
      lastStatusCheckAt: data.last_status_check_at,
      pageId: data.page_id,
      pageName: data.page_name,
      status: data.connection_status,
      tokenExpiresAt: data.token_expires_at ?? null,
      verifiedAt: data.verified_at,
    };
  }

  private async getDefaultBusinessCenterId(organizationId: string): Promise<string> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single<{ id: string }>();

    if (error) {
      throw new Error(`Failed to load default business center: ${error.message}`);
    }

    return data.id;
  }
}
