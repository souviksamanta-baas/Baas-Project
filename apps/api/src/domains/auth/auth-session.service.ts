import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { phoneToSyntheticEmail } from './auth-phone.util';

@Injectable()
export class AuthSessionService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createSessionTokenHashForPhone(phoneE164: string): Promise<string> {
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

    const { data, error } = await client.auth.admin.generateLink({
      email,
      type: 'magiclink',
    });

    if (error || !data.properties.hashed_token) {
      throw new Error(error?.message ?? 'Failed to create login session');
    }

    return data.properties.hashed_token;
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
