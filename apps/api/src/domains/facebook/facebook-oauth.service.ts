import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  assertOrgMembership,
  isOwnerOrCoOwner,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { decryptSecret, encryptSecret } from '../../lib/token-crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { FacebookConnectionSummary } from './facebook-connection.types';

const GRAPH_API_VERSION = 'v20.0';

const OAUTH_SCOPES = [
  'pages_messaging',
  'pages_show_list',
  'pages_manage_metadata',
] as const;

const SUBSCRIBED_FIELDS = [
  'messages',
  'messaging_postbacks',
  'message_deliveries',
  'message_reads',
  'messaging_referrals',
].join(',');

@Injectable()
export class FacebookOAuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async startOAuth(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<{ authUrl: string; redirectUri: string; state: string }> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    if (!isOwnerOrCoOwner(role)) {
      throw new BadRequestException('Solo el dueño o un co-dueño puede conectar Facebook Messenger.');
    }

    const appId = this.requireMetaAppId();
    const redirectUri = this.redirectUri();
    const state = this.signState({
      organizationId: params.organizationId,
      userId: user.id,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const authUrl = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', OAUTH_SCOPES.join(','));
    authUrl.searchParams.set('state', state);

    return { authUrl: authUrl.toString(), redirectUri, state };
  }

  /**
   * Deep link the HTTPS Meta callback bridges into (app scheme, not registered with Meta).
   */
  buildAppDeepLink(params: {
    code?: string;
    error?: string;
    errorDescription?: string;
    state?: string;
  }): string {
    const deepLink = new URL(this.appDeepLinkBase());
    if (params.error) {
      deepLink.searchParams.set('error', params.error);
      if (params.errorDescription) {
        deepLink.searchParams.set('error_description', params.errorDescription);
      }
      return deepLink.toString();
    }
    if (params.code) {
      deepLink.searchParams.set('code', params.code);
    }
    if (params.state) {
      deepLink.searchParams.set('state', params.state);
    }
    return deepLink.toString();
  }

  async handleCallback(params: {
    authorizationHeader: string | undefined;
    code: string;
    pageId?: string;
    state: string;
  }): Promise<FacebookConnectionSummary> {
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
    if (!isOwnerOrCoOwner(role)) {
      throw new BadRequestException('Solo el dueño o un co-dueño puede conectar Facebook Messenger.');
    }

    const userToken = await this.exchangeCode(params.code);
    const pages = await this.fetchUserPages(userToken.accessToken);
    if (pages.length === 0) {
      throw new BadRequestException(
        'No encontramos páginas de Facebook administradas por tu cuenta. Verificá permisos en Meta.',
      );
    }

    const selected =
      pages.find((page) => params.pageId && page.id === params.pageId.trim()) ?? pages[0];

    const businessCenterId = await this.getDefaultBusinessCenterId(state.organizationId);
    const encryptionKey = this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY');
    const encrypted = encryptSecret(selected.accessToken, encryptionKey);
    const verifiedAt = new Date().toISOString();

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('facebook_config')
      .upsert(
        {
          organization_id: state.organizationId,
          business_center_id: businessCenterId,
          page_id: selected.id,
          page_name: selected.name,
          access_token_encrypted: encrypted,
          connection_status: 'connected',
          token_expires_at: null,
          scopes: [...OAUTH_SCOPES],
          verified_at: verifiedAt,
          last_status_check_at: verifiedAt,
          last_error: null,
        },
        { onConflict: 'organization_id,business_center_id' },
      )
      .select(
        'id, page_id, page_name, connection_status, verified_at, last_status_check_at, last_error, token_expires_at',
      )
      .single();

    if (error) {
      throw new Error(`Failed to persist Facebook connection: ${error.message}`);
    }

    try {
      await this.subscribeApps(selected.id, selected.accessToken);
    } catch (subscribeError) {
      const message =
        subscribeError instanceof Error ? subscribeError.message : 'subscribed_apps failed';
      await client
        .from('facebook_config')
        .update({ last_error: message })
        .eq('organization_id', state.organizationId)
        .eq('business_center_id', businessCenterId);
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
    if (!isOwnerOrCoOwner(role)) {
      throw new BadRequestException('Solo el dueño o un co-dueño puede desconectar Facebook Messenger.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const now = new Date().toISOString();
    const { error } = await client
      .from('facebook_config')
      .update({
        connection_status: 'disconnected',
        access_token_encrypted: null,
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
      throw new Error('Missing Facebook access token');
    }
    return decryptSecret(encrypted, this.configService.get<string>('BAAS_TOKEN_ENCRYPTION_KEY'));
  }

  /**
   * Meta App ID from App Dashboard → Settings → Basic. Shared with WhatsApp/Instagram
   * when using a single Meta app; Facebook Login for pages uses the top-level Facebook App ID.
   */
  private requireMetaAppId(): string {
    const appId =
      this.configService.get<string>('META_APP_ID')?.trim() ||
      this.configService.get<string>('FACEBOOK_APP_ID')?.trim();
    if (!appId) {
      throw new ServiceUnavailableException(
        'Facebook Messenger no está configurado (falta META_APP_ID). En Meta: App Dashboard → Settings → Basic → App ID. Cargalo en Railway.',
      );
    }
    return appId;
  }

  private requireMetaAppSecret(): string {
    const secret =
      this.configService.get<string>('META_APP_SECRET')?.trim() ||
      this.configService.get<string>('FACEBOOK_APP_SECRET')?.trim() ||
      this.configService.get<string>('WHATSAPP_APP_SECRET')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Facebook Messenger no está configurado (falta META_APP_SECRET). En Meta: App Dashboard → Settings → Basic → App Secret. Cargalo en Railway.',
      );
    }
    return secret;
  }

  /**
   * Meta Facebook Login only accepts HTTPS redirect URIs registered in the App Dashboard.
   * Custom schemes (baas-owner://) are rejected with "Invalid request: Request parameters are invalid".
   */
  private redirectUri(): string {
    const configured = this.configService.get<string>('FACEBOOK_OAUTH_REDIRECT_URI')?.trim();
    const redirectUri =
      configured ||
      'https://baas-project-production.up.railway.app/integrations/meta/facebook/oauth/callback';
    if (!/^https:\/\//i.test(redirectUri)) {
      throw new ServiceUnavailableException(
        'FACEBOOK_OAUTH_REDIRECT_URI debe ser una URL HTTPS registrada en Meta (no un deep link). Ejemplo: https://baas-project-production.up.railway.app/integrations/meta/facebook/oauth/callback',
      );
    }
    return redirectUri;
  }

  private appDeepLinkBase(): string {
    return (
      this.configService.get<string>('FACEBOOK_OAUTH_APP_DEEP_LINK')?.trim() ||
      'baas-owner://facebook-oauth'
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
    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
    url.searchParams.set('client_id', this.requireMetaAppId());
    url.searchParams.set('client_secret', this.requireMetaAppSecret());
    url.searchParams.set('redirect_uri', this.redirectUri());
    url.searchParams.set('code', code);

    const response = await fetch(url);
    const payload = (await response.json()) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error?.message ?? 'Code exchange failed');
    }
    return { accessToken: payload.access_token };
  }

  private async fetchUserPages(userAccessToken: string): Promise<
    Array<{ accessToken: string; id: string; name: string | null }>
  > {
    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`);
    url.searchParams.set('fields', 'id,name,access_token');
    url.searchParams.set('access_token', userAccessToken);
    const response = await fetch(url);
    const payload = (await response.json()) as {
      data?: Array<{ access_token?: string; id?: string; name?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message ?? 'Failed to list Facebook pages');
    }
    return (payload.data ?? [])
      .filter((page) => Boolean(page.id) && Boolean(page.access_token))
      .map((page) => ({
        accessToken: page.access_token as string,
        id: page.id as string,
        name: page.name?.trim() || null,
      }));
  }

  private async subscribeApps(pageId: string, pageAccessToken: string): Promise<void> {
    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/subscribed_apps`);
    url.searchParams.set('subscribed_fields', SUBSCRIBED_FIELDS);
    url.searchParams.set('access_token', pageAccessToken);
    const response = await fetch(url, { method: 'POST' });
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
