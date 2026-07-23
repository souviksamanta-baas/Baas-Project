import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveAuthUser, assertOrgMembership } from '../../auth/request-auth.helper';
import { encryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { InstagramConnectionSummary } from './instagram-connection.types';

export type { InstagramConnectionSummary } from './instagram-connection.types';

@Injectable()
export class InstagramConnectionService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /** @deprecated Prefer InstagramOAuthService — kept for emergency/manual ops. */
  async registerConnection(params: {
    accessToken: string;
    authorizationHeader: string | undefined;
    igUserId: string;
    igUsername?: string;
    organizationId: string;
    pageId?: string;
  }): Promise<InstagramConnectionSummary> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    if (role !== 'owner') {
      throw new Error('Only organization owners can register Instagram connections');
    }

    const businessCenterId = await this.getDefaultBusinessCenterId(params.organizationId);
    const verifiedAt = new Date().toISOString();
    const client = this.supabaseService.getServiceRoleClient();
    const encrypted = encryptSecret(
      params.accessToken.trim(),
      this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY'),
    );

    const { data, error } = await client
      .from('instagram_config')
      .upsert(
        {
          organization_id: params.organizationId,
          business_center_id: businessCenterId,
          page_id: params.pageId?.trim() || null,
          ig_user_id: params.igUserId.trim(),
          ig_username: params.igUsername?.trim() || null,
          access_token_encrypted: encrypted,
          connection_status: 'connected',
          token_status: 'active',
          verified_at: verifiedAt,
          last_status_check_at: verifiedAt,
          last_error: null,
          disconnected_at: null,
        },
        { onConflict: 'organization_id,business_center_id' },
      )
      .select(
        'page_id, ig_user_id, ig_username, connection_status, verified_at, last_status_check_at, last_error, profile_picture_url, token_expires_at',
      )
      .single();

    if (error) {
      throw new Error(`Failed to register Instagram connection: ${error.message}`);
    }

    return {
      igUserId: data.ig_user_id,
      igUsername: data.ig_username,
      lastError: data.last_error,
      lastStatusCheckAt: data.last_status_check_at,
      pageId: data.page_id,
      profilePictureUrl: data.profile_picture_url ?? null,
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
