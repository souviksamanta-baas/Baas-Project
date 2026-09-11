import { Injectable, Optional } from '@nestjs/common';

import { RegisteredOwnerClaimService } from '../admin/registered-owner-claim.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { phoneToSyntheticEmail } from './auth-phone.util';

export type MintedAuthSession = {
  accessToken: string;
  refreshToken: string;
  /** @deprecated Prefer accessToken/refreshToken; kept for older clients. */
  tokenHash: string;
};

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional() private readonly registeredOwnerClaimService?: RegisteredOwnerClaimService,
  ) {}

  async createSessionForPhone(phoneE164: string): Promise<MintedAuthSession> {
    const email = phoneToSyntheticEmail(phoneE164);
    const client = this.supabaseService.getServiceRoleClient();

    const { error: createError } = await client.auth.admin.createUser({
      email,
      email_confirm: true,
      phone: phoneE164,
      phone_confirm: true,
      user_metadata: {
        auth_phone: phoneE164,
      },
    });

    if (createError && !/already|registered|exists/i.test(createError.message)) {
      console.error(`[auth] Failed to create phone auth user: ${createError.message}`);
      throw new Error('No se pudo crear la sesión. Intentá de nuevo.');
    }

    return this.mintSessionForEmail(email);
  }

  async createSessionForEmail(email: string): Promise<MintedAuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const client = this.supabaseService.getServiceRoleClient();

    const { error: createError } = await client.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: {
        auth_email: normalizedEmail,
      },
    });

    if (createError && !/already|registered|exists/i.test(createError.message)) {
      console.error(`[auth] Failed to create email auth user: ${createError.message}`);
      throw new Error('No se pudo crear la sesión. Intentá de nuevo.');
    }

    const session = await this.mintSessionForEmail(normalizedEmail);

    if (this.registeredOwnerClaimService) {
      try {
        await this.registeredOwnerClaimService.claimOwnerByEmail(normalizedEmail);
      } catch {
        // Non-blocking: session still works; claim can retry on next login
      }
    }

    return session;
  }

  /** @deprecated Use createSessionForPhone — kept for any residual callers. */
  async createSessionTokenHashForPhone(phoneE164: string): Promise<string> {
    const session = await this.createSessionForPhone(phoneE164);
    return session.tokenHash;
  }

  /** @deprecated Use createSessionForEmail — kept for any residual callers. */
  async createSessionTokenHashForEmail(email: string): Promise<string> {
    const session = await this.createSessionForEmail(email);
    return session.tokenHash;
  }

  private async mintSessionForEmail(email: string): Promise<MintedAuthSession> {
    const adminClient = this.supabaseService.getServiceRoleClient();
    const { data, error } = await adminClient.auth.admin.generateLink({
      email,
      type: 'magiclink',
    });

    const hashedToken =
      data?.properties?.hashed_token ||
      (data?.properties as { hashedToken?: string } | undefined)?.hashedToken;

    if (error || !hashedToken) {
      console.error(`[auth] Failed to create login session: ${error?.message ?? 'missing hashed token'}`);
      throw new Error('No se pudo crear la sesión. Intentá de nuevo.');
    }

    // Exchange on an ephemeral client. verifyOtp attaches a user session to the
    // client instance; doing that on the shared service-role singleton made later
    // Nest DB calls run as `authenticated` (permission denied on auth_otp_challenges).
    const exchangeClient = this.supabaseService.createEphemeralServiceRoleClient();
    try {
      const exchanged = await exchangeClient.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'magiclink',
      });

      if (exchanged.error || !exchanged.data.session) {
        console.error(
          `[auth] Failed to exchange login session token: ${exchanged.error?.message ?? 'missing session'}`,
        );
        throw new Error('No se pudo crear la sesión. Pedí un código nuevo e intentá otra vez.');
      }

      return {
        accessToken: exchanged.data.session.access_token,
        refreshToken: exchanged.data.session.refresh_token,
        tokenHash: hashedToken,
      };
    } finally {
      await exchangeClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  }

  async getUserIdFromBearerToken(authorizationHeader: string | undefined): Promise<string> {
    const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      throw new Error('Falta el token de sesión.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      throw new Error('La sesión no es válida.');
    }

    return data.user.id;
  }
}
