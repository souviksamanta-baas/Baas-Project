import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

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
  verifiedPhoneE164: string;
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
    const userId = await this.authSessionService.getUserIdFromBearerToken(
      params.authorizationHeader,
    );
    const tokenHash = createHash('sha256').update(params.inviteToken.trim()).digest('hex');
    const client = this.supabaseService.getServiceRoleClient();

    const { data: invite, error } = await client
      .from('organization_invites')
      .select(
        'id, organization_id, business_center_id, invited_business_center_ids, invited_phone_e164, org_role, center_role, expires_at, accepted_at, revoked_at',
      )
      .eq('token_hash', tokenHash)
      .maybeSingle<{
        accepted_at: string | null;
        business_center_id: string | null;
        center_role: 'manager' | 'staff';
        expires_at: string;
        id: string;
        invited_business_center_ids: string[] | null;
        invited_phone_e164: string;
        org_role: 'owner' | 'staff';
        organization_id: string;
        revoked_at: string | null;
      }>();

    if (error) {
      throw new Error(`Failed to load invite: ${error.message}`);
    }

    if (!invite || invite.revoked_at || invite.accepted_at) {
      throw new Error('La invitación no es válida.');
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error('La invitación expiró.');
    }

    if (invite.invited_phone_e164 !== params.verifiedPhoneE164) {
      throw new Error('El número verificado no coincide con la invitación.');
    }

    const { data: existingMember } = await client
      .from('organization_members')
      .select('id')
      .eq('organization_id', invite.organization_id)
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>();

    if (!existingMember) {
      const { data: member, error: memberError } = await client
        .from('organization_members')
        .insert({
          organization_id: invite.organization_id,
          user_id: userId,
          role: invite.org_role,
        })
        .select('id')
        .single<{ id: string }>();

      if (memberError || !member) {
        throw new Error(`Failed to add organization member: ${memberError?.message}`);
      }

      const businessCenterIds = await this.resolveAcceptedBusinessCenterIds(invite);

      for (const businessCenterId of businessCenterIds) {
        await client.from('business_center_members').insert({
          organization_id: invite.organization_id,
          business_center_id: businessCenterId,
          organization_member_id: member.id,
          role: invite.center_role,
        });
      }
    }

    await client
      .from('organization_invites')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId,
      })
      .eq('id', invite.id);

    return { organizationId: invite.organization_id };
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

  private async resolveAcceptedBusinessCenterIds(invite: {
    business_center_id: string | null;
    invited_business_center_ids: string[] | null;
    organization_id: string;
  }): Promise<string[]> {
    const ids = invite.invited_business_center_ids?.filter(Boolean) ?? [];
    if (ids.length > 0) {
      return [...new Set(ids)];
    }

    if (invite.business_center_id) {
      return [invite.business_center_id];
    }

    const defaultId = await this.getDefaultBusinessCenterId(invite.organization_id);
    return defaultId ? [defaultId] : [];
  }

  private async getDefaultBusinessCenterId(organizationId: string): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(`Failed to resolve default business center: ${error.message}`);
    }

    return data?.id ?? null;
  }
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
