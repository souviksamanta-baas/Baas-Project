import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';

import { SupabaseService } from '../supabase/supabase.service';

export function extractBearerToken(
  authorizationHeader: string | undefined,
): string {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new UnauthorizedException('Missing bearer token');
  }
  return token;
}

export async function resolveAuthUser(
  supabaseService: SupabaseService,
  authorizationHeader: string | undefined,
): Promise<User> {
  const token = extractBearerToken(authorizationHeader);
  const client = supabaseService.getServiceRoleClient();
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    throw new UnauthorizedException('Invalid bearer token');
  }

  return data.user;
}

export async function resolveUserId(
  supabaseService: SupabaseService,
  authorizationHeader: string | undefined,
): Promise<string> {
  const user = await resolveAuthUser(supabaseService, authorizationHeader);
  return user.id;
}

export async function assertOrgMembership(params: {
  organizationId: string;
  supabaseService: SupabaseService;
  userId: string;
}): Promise<'owner' | 'staff'> {
  const client = params.supabaseService.getServiceRoleClient();
  const { data, error } = await client
    .from('organization_members')
    .select('role')
    .eq('organization_id', params.organizationId)
    .eq('user_id', params.userId)
    .maybeSingle<{ role: 'owner' | 'staff' }>();

  if (error) {
    throw new Error(`Failed to verify organization membership: ${error.message}`);
  }

  if (!data) {
    throw new ForbiddenException('Not a member of this organization');
  }

  return data.role;
}

/** Phone used for platform auth (E.164), never trust client-supplied values. */
export function phoneFromAuthUser(user: User): string | null {
  const candidates = [
    user.phone,
    typeof user.user_metadata?.auth_phone === 'string'
      ? user.user_metadata.auth_phone
      : null,
  ];

  for (const raw of candidates) {
    const normalized = normalizeAuthPhoneE164(raw);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function normalizeAuthPhoneE164(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 8 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8 ? `+${digits}` : null;
}
