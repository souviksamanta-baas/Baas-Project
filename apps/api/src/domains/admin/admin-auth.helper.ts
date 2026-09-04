import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';

import { resolveAuthUser } from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';

export type NexoliaStaffRole = 'admin' | 'super_admin';

export interface NexoliaStaffContext {
  email: string;
  role: NexoliaStaffRole;
  user: User;
  userId: string;
}

function normalizeEmail(email: string | undefined | null): string {
  return (email ?? '').trim().toLowerCase();
}

function asStaffRole(role: string | undefined | null): NexoliaStaffRole {
  return role === 'super_admin' ? 'super_admin' : 'admin';
}

/**
 * Staff gate: must already be in `nexolia_staff`, or hold an unused invite in
 * `nexolia_staff_invites` (email match). Open Google sign-in alone is not enough.
 */
export async function assertNexoliaStaff(
  supabaseService: SupabaseService,
  authorizationHeader: string | undefined,
): Promise<NexoliaStaffContext> {
  const user = await resolveAuthUser(supabaseService, authorizationHeader);
  const client = supabaseService.getServiceRoleClient();
  const email = normalizeEmail(user.email);

  const { data, error } = await client
    .from('nexolia_staff')
    .select('role, email')
    .eq('user_id', user.id)
    .maybeSingle<{ email: string; role: string }>();

  if (error) {
    throw new Error(`Failed to verify nexolia staff: ${error.message}`);
  }

  if (data) {
    return {
      email: data.email,
      role: asStaffRole(data.role),
      user,
      userId: user.id,
    };
  }

  if (!email) {
    throw new ForbiddenException('No sos staff de Nexolia');
  }

  // Claim pending invite (invitation-only onboarding for additional staff).
  const { data: invite, error: inviteError } = await client
    .from('nexolia_staff_invites')
    .select('id, role, email')
    .is('accepted_at', null)
    .ilike('email', email)
    .maybeSingle<{ email: string; id: string; role: string }>();

  if (inviteError) {
    throw new Error(`Failed to verify staff invite: ${inviteError.message}`);
  }

  if (!invite) {
    throw new ForbiddenException(
      'No sos staff de Nexolia. Pedí una invitación al equipo.',
    );
  }

  const role = asStaffRole(invite.role);
  const { error: upsertError } = await client.from('nexolia_staff').upsert(
    {
      display_name: email.split('@')[0] || email,
      email,
      role,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (upsertError) {
    throw new Error(`Failed to claim staff invite: ${upsertError.message}`);
  }

  const { error: acceptError } = await client
    .from('nexolia_staff_invites')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (acceptError) {
    throw new Error(`Failed to mark staff invite accepted: ${acceptError.message}`);
  }

  return {
    email,
    role,
    user,
    userId: user.id,
  };
}

export async function writeAdminAudit(params: {
  action: string;
  actorStaffId: string;
  entityId?: string;
  entityType?: string;
  payload?: Record<string, unknown>;
  supabaseService: SupabaseService;
  via?: 'ui' | 'grok';
}): Promise<void> {
  const client = params.supabaseService.getServiceRoleClient();
  const { error } = await client.from('admin_audit_log').insert({
    action: params.action,
    actor_staff_id: params.actorStaffId,
    entity_id: params.entityId ?? null,
    entity_type: params.entityType ?? null,
    payload: params.payload ?? {},
    via: params.via ?? 'ui',
  });

  if (error) {
    throw new Error(`Failed to write admin audit log: ${error.message}`);
  }
}

export function requireStaffToken(
  authorizationHeader: string | undefined,
): asserts authorizationHeader is string {
  if (!authorizationHeader?.trim()) {
    throw new UnauthorizedException('Missing bearer token');
  }
}
