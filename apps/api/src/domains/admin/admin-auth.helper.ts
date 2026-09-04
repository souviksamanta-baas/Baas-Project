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

export async function assertNexoliaStaff(
  supabaseService: SupabaseService,
  authorizationHeader: string | undefined,
): Promise<NexoliaStaffContext> {
  const user = await resolveAuthUser(supabaseService, authorizationHeader);
  const client = supabaseService.getServiceRoleClient();
  const { data, error } = await client
    .from('nexolia_staff')
    .select('role, email')
    .eq('user_id', user.id)
    .maybeSingle<{ email: string; role: string }>();

  if (error) {
    throw new Error(`Failed to verify nexolia staff: ${error.message}`);
  }

  if (!data) {
    throw new ForbiddenException('No sos staff de Nexolia');
  }

  return {
    email: data.email,
    role: data.role === 'super_admin' ? 'super_admin' : 'admin',
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
