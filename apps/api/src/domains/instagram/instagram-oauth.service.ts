import { createHmac, timingSafeEqual } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  assertOrgMembership,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { decryptSecret, encryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { InstagramHistorySyncService } from './instagram-history-sync.service';
import type { InstagramConnectionSummary } from './instagram-connection.types';

const OAUTH_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
] as const;

const SUBSCRIBED_FIELDS = [
  'messages',
  'messaging_seen',
  'message_reactions',
  'messaging_postbacks',
  'messaging_referral',
].join(',');

@Injectable()
export class InstagramOAuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly historySync: InstagramHistorySyncService,
  ) {}

  async startOAuth(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<{ authUrl: string; state: string }> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    if (role !== 'owner') {
      throw new BadRequestException('Solo el dueño puede conectar Instagram.');
    }

    const appId = this.requireMetaAppId();
    const redirectUri = this.redirectUri();
    const state = this.signState({
      organizationId: params.organizationId,
      userId: user.id,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const authUrl = new URL('https://www.instagram.com/oauth/authorize');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', OAUTH_SCOPES.join(','));
    authUrl.searchParams.set('state', state);

    return { authUrl: authUrl.toString(), state };
  }

  async handleCallback(params: {
    authorizationHeader: string | undefined;
    code: string;
    state: string;
  }): Promise<InstagramConnectionSummary> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const state = this.verifyState(params.state);
    if (state.userId !== user.id) {
      throw new BadRequestException('Estado OAuth inválido.');
    }

    const role = await assertOrgMembership({
      organizationId: state.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    if (role !== 'owner') {
      throw new BadRequestException('Solo el dueño puede conectar Instagram.');
    }

    const shortLived = await this.exchangeCode(params.code);
    const longLived = await this.exchangeLongLived(shortLived.accessToken);
    const profile = await this.fetchIgProfile(longLived.accessToken);

    const businessCenterId = await this.getDefaultBusinessCenterId(state.organizationId);
    const encryptionKey = this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY');
    const encrypted = encryptSecret(longLived.accessToken, encryptionKey);
    const verifiedAt = new Date().toISOString();
    const expiresAt = longLived.expiresIn
      ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString()
      : null;

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('instagram_config')
      .upsert(
        {
          organization_id: state.organizationId,
          business_center_id: businessCenterId,
          page_id: profile.pageId,
          ig_user_id: profile.igUserId,
          ig_username: profile.username,
          profile_picture_url: profile.profilePictureUrl,
          access_token_encrypted: encrypted,
          connection_status: 'connected',
          token_status: 'active',
          token_expires_at: expiresAt,
          scopes: [...OAUTH_SCOPES],
          verified_at: verifiedAt,
          last_status_check_at: verifiedAt,
          last_error: null,
          disconnected_at: null,
        },
        { onConflict: 'organization_id,business_center_id' },
      )
      .select(
        'id, page_id, ig_user_id, ig_username, connection_status, verified_at, last_status_check_at, last_error, profile_picture_url, token_expires_at',
      )
      .single();

    if (error) {
      throw new Error(`Failed to persist Instagram connection: ${error.message}`);
    }

    try {
      await this.subscribeApps(profile.igUserId, longLived.accessToken);
    } catch (subscribeError) {
      const message =
        subscribeError instanceof Error ? subscribeError.message : 'subscribed_apps failed';
      await client
        .from('instagram_config')
        .update({ last_error: message })
        .eq('organization_id', state.organizationId)
        .eq('business_center_id', businessCenterId);
    }

    void this.historySync
      .importRecentConversations({
        accessToken: longLived.accessToken,
        businessCenterId,
        igUserId: profile.igUserId,
        instagramConfigId: data.id,
        organizationId: state.organizationId,
      })
      .catch(() => undefined);

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

  async disconnect(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<{ disconnected: true }> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    if (role !== 'owner') {
      throw new BadRequestException('Solo el dueño puede desconectar Instagram.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const now = new Date().toISOString();
    const { error } = await client
      .from('instagram_config')
      .update({
        connection_status: 'disabled',
        token_status: 'revoked',
        access_token_encrypted: null,
        disconnected_at: now,
        last_status_check_at: now,
      })
      .eq('organization_id', params.organizationId);

    if (error) {
      throw new Error(error.message);
    }

    return { disconnected: true };
  }

  resolveAccessToken(encrypted: string | null): string {
    if (!encrypted) {
      throw new Error('Missing Instagram access token');
    }
    return decryptSecret(encrypted, this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY'));
  }

  private requireMetaAppId(): string {
    const appId =
      this.configService.get<string>('META_APP_ID') ??
      this.configService.get<string>('INSTAGRAM_APP_ID');
    if (!appId?.trim()) {
      throw new Error('META_APP_ID is not configured');
    }
    return appId.trim();
  }

  private requireMetaAppSecret(): string {
    const secret =
      this.configService.get<string>('META_APP_SECRET') ??
      this.configService.get<string>('INSTAGRAM_APP_SECRET') ??
      this.configService.get<string>('WHATSAPP_APP_SECRET');
    if (!secret?.trim()) {
      throw new Error('META_APP_SECRET is not configured');
    }
    return secret.trim();
  }

  private redirectUri(): string {
    return (
      this.configService.get<string>('INSTAGRAM_OAUTH_REDIRECT_URI')?.trim() ||
      'baas-owner://instagram-oauth'
    );
  }

  private signState(payload: { exp: number; organizationId: string; userId: string }): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.requireMetaAppSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): { exp: number; organizationId: string; userId: string } {
    const [body, sig] = state.split('.');
    if (!body || !sig) {
      throw new BadRequestException('Estado OAuth inválido.');
    }
    const expected = createHmac('sha256', this.requireMetaAppSecret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Estado OAuth inválido.');
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      exp: number;
      organizationId: string;
      userId: string;
    };
    if (!parsed.exp || parsed.exp < Date.now()) {
      throw new BadRequestException('El enlace de autorización expiró. Probá de nuevo.');
    }
    return parsed;
  }

  private async exchangeCode(code: string): Promise<{ accessToken: string }> {
    const body = new URLSearchParams({
      client_id: this.requireMetaAppId(),
      client_secret: this.requireMetaAppSecret(),
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri(),
      code,
    });
    const response = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = (await response.json()) as {
      access_token?: string;
      error_message?: string;
      error?: { message?: string };
    };
    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error_message ?? payload.error?.message ?? 'Code exchange failed');
    }
    return { accessToken: payload.access_token };
  }

  private async exchangeLongLived(
    shortLivedToken: string,
  ): Promise<{ accessToken: string; expiresIn: number | null }> {
    const url = new URL('https://graph.instagram.com/access_token');
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', this.requireMetaAppSecret());
    url.searchParams.set('access_token', shortLivedToken);
    const response = await fetch(url);
    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!response.ok || !payload.access_token) {
      // Fall back to short-lived if long-lived exchange is unavailable in the app mode.
      return { accessToken: shortLivedToken, expiresIn: null };
    }
    return { accessToken: payload.access_token, expiresIn: payload.expires_in ?? null };
  }

  private async fetchIgProfile(accessToken: string): Promise<{
    igUserId: string;
    pageId: string | null;
    profilePictureUrl: string | null;
    username: string | null;
  }> {
    const url = new URL('https://graph.instagram.com/v21.0/me');
    url.searchParams.set('fields', 'user_id,username,profile_picture_url,account_type');
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url);
    const payload = (await response.json()) as {
      id?: string;
      user_id?: string;
      username?: string;
      profile_picture_url?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message ?? 'Failed to load Instagram profile');
    }
    const igUserId = payload.user_id ?? payload.id;
    if (!igUserId) {
      throw new Error('Instagram profile did not return a user id');
    }
    return {
      igUserId,
      pageId: null,
      profilePictureUrl: payload.profile_picture_url ?? null,
      username: payload.username ?? null,
    };
  }

  private async subscribeApps(igUserId: string, accessToken: string): Promise<void> {
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${igUserId}/subscribed_apps?subscribed_fields=${encodeURIComponent(SUBSCRIBED_FIELDS)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      throw new Error(payload.error?.message ?? `subscribed_apps failed (${response.status})`);
    }
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
