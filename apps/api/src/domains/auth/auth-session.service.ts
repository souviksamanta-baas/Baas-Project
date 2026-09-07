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
      throw new Error(`Failed to create auth user: ${createError.message}`);
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
      throw new Error(`Failed to create auth user: ${createError.message}`);
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
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.auth.admin.generateLink({
      email,
      type: 'magiclink',
    });

    const hashedToken =
      data?.properties?.hashed_token ||
      (data?.properties as { hashedToken?: string } | undefined)?.hashedToken;

    if (error || !hashedToken) {
      throw new Error(error?.message ?? 'Failed to create login session');
    }

    // Exchange once on the server with the matching type. Mobile used to try
    // type "email" first, which can burn the one-time hash and surface
    // "Email link is invalid or has expired".
    const exchanged = await client.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    });

    if (exchanged.error || !exchanged.data.session) {
      throw new Error(
        exchanged.error?.message ?? 'Failed to exchange login session token',
      );
    }

    return {
      accessToken: exchanged.data.session.access_token,
      refreshToken: exchanged.data.session.refresh_token,
      tokenHash: hashedToken,
    };
  }

  async getUserIdFromBearerToken(authorizationHeader: string | undefined): Promise<string> {
    const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      throw new Error('Missing bearer token');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      throw new Error('Invalid bearer token');
    }

    return data.user.id;
  }
}
