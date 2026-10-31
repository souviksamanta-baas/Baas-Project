import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import QRCode from 'qrcode';

import { SupabaseService } from '../../supabase/supabase.service';
import { AuthSessionService } from './auth-session.service';

const CHALLENGE_TTL_MS = 90_000;
const BROWSER_ORIGIN = process.env.BROWSER_SESSION_ORIGIN || 'https://web.nexolia.com.ar';

type ChallengeRow = {
  access_token: string | null;
  expires_at: string;
  id: string;
  organization_id: string | null;
  poll_secret_hash: string;
  refresh_token: string | null;
  status: 'pending' | 'approved' | 'consumed' | 'expired';
  user_id: string | null;
};

export type BrowserSessionCreateResult = {
  challengeId: string;
  expiresAt: string;
  pairUrl: string;
  pollSecret: string;
  qrSvg: string;
};

export type BrowserSessionPollResult =
  | { expiresAt: string; status: 'pending' }
  | { status: 'expired' }
  | { accessToken: string; organizationId: string | null; refreshToken: string; status: 'approved' };

@Injectable()
export class BrowserSessionService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async create(): Promise<BrowserSessionCreateResult> {
    const challengeId = randomUUID();
    const pollSecret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
    const pairUrl = `${BROWSER_ORIGIN}/pair?c=${challengeId}`;
    const client = this.supabaseService.getServiceRoleClient();

    const { error } = await client.from('browser_session_challenges').insert({
      expires_at: expiresAt,
      id: challengeId,
      poll_secret_hash: hashSecret(pollSecret),
      status: 'pending',
    });

    if (error) {
      throw new BadRequestException('No se pudo generar el código. Intentá de nuevo.');
    }

    const qrSvg = await QRCode.toString(pairUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      type: 'svg',
    });

    return {
      challengeId,
      expiresAt,
      pairUrl,
      pollSecret,
      qrSvg,
    };
  }

  async approve(
    challengeId: string,
    userId: string,
    accessToken: string,
    organizationId: string | null,
  ): Promise<{ status: 'approved' }> {
    const client = this.supabaseService.getServiceRoleClient();
    const row = await this.loadChallenge(challengeId);
    if (organizationId) {
      await this.assertActiveOrganization(accessToken, organizationId);
    }

    if (row.status === 'approved' || row.status === 'consumed') {
      throw new ConflictException('Este código ya fue usado.');
    }

    if (row.status === 'expired' || new Date(row.expires_at).getTime() <= Date.now()) {
      await client
        .from('browser_session_challenges')
        .update({ access_token: null, refresh_token: null, status: 'expired' })
        .eq('id', challengeId);
      throw new GoneException('El código venció. Generá uno nuevo en la computadora.');
    }

    let session: { accessToken: string; refreshToken: string };
    try {
      session = await this.authSessionService.mintDesktopSessionForUser(userId);
    } catch {
      throw new UnauthorizedException('No se pudo abrir la sesión de escritorio.');
    }
    const { data: approved, error } = await client
      .from('browser_session_challenges')
      .update({
        access_token: session.accessToken,
        organization_id: organizationId,
        refresh_token: session.refreshToken,
        status: 'approved',
        user_id: userId,
      })
      .eq('id', challengeId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (error || !approved) {
      throw new ConflictException('Este código ya fue usado.');
    }

    return { status: 'approved' };
  }

  async poll(challengeId: string, pollSecret: string): Promise<BrowserSessionPollResult> {
    const client = this.supabaseService.getServiceRoleClient();
    const row = await this.loadChallenge(challengeId);

    if (!secretsMatch(row.poll_secret_hash, hashSecret(pollSecret))) {
      throw new UnauthorizedException('El código no es válido.');
    }

    if (row.status === 'expired' || row.status === 'consumed') {
      return { status: 'expired' };
    }

    if (new Date(row.expires_at).getTime() <= Date.now() && row.status === 'pending') {
      await client
        .from('browser_session_challenges')
        .update({ status: 'expired' })
        .eq('id', challengeId);
      return { status: 'expired' };
    }

    if (row.status === 'pending') {
      return { expiresAt: row.expires_at, status: 'pending' };
    }

    const accessToken = row.access_token;
    const refreshToken = row.refresh_token;
    if (!accessToken || !refreshToken) {
      return { status: 'expired' };
    }

    await client
      .from('browser_session_challenges')
      .update({
        access_token: null,
        refresh_token: null,
        status: 'consumed',
      })
      .eq('id', challengeId)
      .eq('status', 'approved');

    return { accessToken, organizationId: row.organization_id, refreshToken, status: 'approved' };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const client = this.supabaseService.createEphemeralServiceRoleClient();
    const exchanged = await client.auth.refreshSession({ refresh_token: refreshToken });
    const session = exchanged.data.session;
    if (exchanged.error || !session) {
      throw new UnauthorizedException('La sesión venció. Escaneá el código otra vez.');
    }
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    };
  }

  private async assertActiveOrganization(accessToken: string, organizationId: string): Promise<void> {
    const client = this.supabaseService.createUserClient(accessToken);
    const { data, error } = await client.rpc('get_owner_dashboard', {
      p_organization_id: organizationId,
    });
    const resolved = (data as { organization?: { id?: string } | null } | null)?.organization?.id;
    if (error || resolved !== organizationId) {
      throw new BadRequestException('Ese negocio no está activo en tu celular.');
    }
  }

  private async loadChallenge(challengeId: string): Promise<ChallengeRow> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('browser_session_challenges')
      .select('id, poll_secret_hash, status, expires_at, user_id, organization_id, access_token, refresh_token')
      .eq('id', challengeId)
      .maybeSingle();

    if (error || !data) {
      throw new UnauthorizedException('El código no es válido.');
    }

    return data as ChallengeRow;
  }
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function secretsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
