import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import {
  normalizeAuthPhoneE164,
  phoneFromAuthUser,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthSessionService } from '../auth/auth-session.service';

export type OrganizationInviteRole = 'employee' | 'manager' | 'co_owner';

export interface CreateOrganizationInviteParams {
  authorizationHeader: string | undefined;
  businessCenterId?: string;
  businessCenterIds?: string[];
  invitedDisplayName?: string;
  invitedPhoneE164: string;
  organizationId: string;
  role: OrganizationInviteRole;
}

export interface OrganizationInviteSummary {
  expiresAt: string;
  id: string;
  inviteToken: string;
  invitedDisplayName: string | null;
  invitedPhoneE164: string;
  organizationId: string;
  role: OrganizationInviteRole;
}

export interface AcceptOrganizationInviteParams {
  authorizationHeader: string | undefined;
  inviteToken: string;
  /** Ignored as auth evidence; optional mismatch logging only. */
  verifiedPhoneE164?: string;
}

@Injectable()
export class OrganizationInvitesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async createInvite(params: CreateOrganizationInviteParams): Promise<OrganizationInviteSummary> {
    const createdBy = await this.assertOwner({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    const inviteToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(inviteToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const { orgRole, centerRole } = mapInviteRole(params.role);
    const businessCenterIds = resolveBusinessCenterIds(params);

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_invites')
      .insert({
        organization_id: params.organizationId,
        business_center_id: businessCenterIds[0] ?? null,
        invited_business_center_ids: businessCenterIds,
        invited_phone_e164: params.invitedPhoneE164,
        invited_display_name: params.invitedDisplayName?.trim() || null,
        org_role: orgRole,
        center_role: centerRole,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: createdBy,
      })
      .select('id, organization_id, invited_phone_e164, invited_display_name, expires_at')
      .single<{
        expires_at: string;
        id: string;
        invited_display_name: string | null;
        invited_phone_e164: string;
        organization_id: string;
      }>();

    if (error) {
      throw new Error(`Failed to create invite: ${error.message}`);
    }

    return {
      expiresAt: data.expires_at,
      id: data.id,
      inviteToken,
      invitedDisplayName: data.invited_display_name,
      invitedPhoneE164: data.invited_phone_e164,
      organizationId: data.organization_id,
      role: params.role,
    };
  }

  async acceptInvite(params: AcceptOrganizationInviteParams): Promise<{ organizationId: string }> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const authPhone = phoneFromAuthUser(user);

    if (!authPhone) {
      throw new Error('El número verificado no está disponible en la sesión.');
    }

    const clientPhone = normalizeAuthPhoneE164(params.verifiedPhoneE164);
    if (clientPhone && clientPhone !== authPhone) {
      console.warn(
        '[invites] Client verifiedPhoneE164 does not match auth user phone; ignoring client value.',
      );
    }

    const tokenHash = createHash('sha256').update(params.inviteToken.trim()).digest('hex');
    const client = this.supabaseService.getServiceRoleClient();
    const { data: organizationId, error } = await client.rpc('accept_organization_invite', {
      p_token_hash: tokenHash,
      p_user_id: user.id,
      p_verified_phone_e164: authPhone,
    });

    if (error) {
      throw new Error(mapInviteRpcError(error.message));
    }

    if (!organizationId || typeof organizationId !== 'string') {
      throw new Error('La invitación no es válida.');
    }

    return { organizationId };
  }

  private async assertOwner(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<string> {
    const userId = await this.authSessionService.getUserIdFromBearerToken(
      params.authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_members')
      .select('role')
      .eq('organization_id', params.organizationId)
      .eq('user_id', userId)
      .maybeSingle<{ role: 'owner' | 'staff' }>();

    if (error) {
      throw new Error(`Failed to verify organization membership: ${error.message}`);
    }

    if (!data || data.role !== 'owner') {
      throw new Error('Only organization owners can manage invites.');
    }

    return userId;
  }
}

function mapInviteRpcError(message: string): string {
  if (/PHONE_MISMATCH/i.test(message)) {
    return 'El número verificado no coincide con la invitación.';
  }

  if (/INVITE_EXPIRED/i.test(message)) {
    return 'La invitación expiró.';
  }

  if (/PHONE_REQUIRED/i.test(message)) {
    return 'El número verificado no está disponible en la sesión.';
  }

  if (/INVALID_INVITE|INVALID_USER/i.test(message)) {
    return 'La invitación no es válida.';
  }

  return `Failed to accept invite: ${message}`;
}

function mapInviteRole(role: OrganizationInviteRole): {
  centerRole: 'manager' | 'staff';
  orgRole: 'owner' | 'staff';
} {
  switch (role) {
    case 'co_owner':
      return { orgRole: 'staff', centerRole: 'manager' };
    case 'manager':
      return { orgRole: 'staff', centerRole: 'manager' };
    default:
      return { orgRole: 'staff', centerRole: 'staff' };
  }
}

function resolveBusinessCenterIds(params: CreateOrganizationInviteParams): string[] {
  const ids = params.businessCenterIds?.filter(Boolean) ?? [];
  if (ids.length > 0) {
    return [...new Set(ids)];
  }

  return params.businessCenterId ? [params.businessCenterId] : [];
}
