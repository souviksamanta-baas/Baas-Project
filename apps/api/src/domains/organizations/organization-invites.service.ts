import {
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import {
  assertOrgMembership,
  isOwnerOrCoOwner,
  normalizeAuthPhoneE164,
  phoneFromAuthUser,
  resolveAuthUser,
  type OrganizationMemberRole,
} from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async createInvite(params: CreateOrganizationInviteParams): Promise<OrganizationInviteSummary> {
    const actor = await this.resolveInviteActor({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    if (!isOrganizationInviteRole(params.role)) {
      throw new Error('Rol de invitación inválido. Elegí Empleado, Administrador o Co-dueño.');
    }

    assertCanInviteRole(actor.role, params.role);

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
        created_by: actor.userId,
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

    const { data: inviteRow } = await client
      .from('organization_invites')
      .select('invited_display_name')
      .eq('token_hash', tokenHash)
      .maybeSingle<{ invited_display_name: string | null }>();

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

    const invitedDisplayName = inviteRow?.invited_display_name?.trim();
    if (invitedDisplayName) {
      const existingMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const existingName = String(existingMetadata.full_name ?? existingMetadata.name ?? '').trim();
      if (!existingName) {
        await client.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...existingMetadata,
            full_name: invitedDisplayName,
          },
        });
      }
    }

    if (this.notificationsService) {
      const { data: center } = await client
        .from('business_centers')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (center?.id) {
        await this.notificationsService.notifyTeamInviteAccepted({
          businessCenterId: center.id,
          displayName: invitedDisplayName || 'Nuevo miembro',
          organizationId,
          userId: user.id,
        });
      }
    }

    return { organizationId };
  }

  private async resolveInviteActor(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<{ role: OrganizationMemberRole; userId: string }> {
    const userId = await this.authSessionService.getUserIdFromBearerToken(
      params.authorizationHeader,
    );
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId,
    });

    if (role === 'staff') {
      throw new ForbiddenException('No tenés permiso para invitar miembros.');
    }

    return { role, userId };
  }
}

function assertCanInviteRole(
  actorRole: OrganizationMemberRole,
  inviteRole: OrganizationInviteRole,
): void {
  if (isOwnerOrCoOwner(actorRole)) {
    return;
  }

  if (actorRole === 'manager' && inviteRole === 'employee') {
    return;
  }

  throw new ForbiddenException(
    'Solo el dueño o un co-dueño puede invitar administradores o co-dueños. Un administrador solo puede invitar empleados.',
  );
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

  if (/INVITE_ALREADY_USED/i.test(message)) {
    return 'Esa invitación ya fue usada. Pedile al dueño un QR nuevo.';
  }

  if (/INVALID_INVITE|INVALID_USER/i.test(message)) {
    return 'La invitación no es válida.';
  }

  return `Failed to accept invite: ${message}`;
}

function isOrganizationInviteRole(role: unknown): role is OrganizationInviteRole {
  return role === 'employee' || role === 'manager' || role === 'co_owner';
}

function mapInviteRole(role: OrganizationInviteRole): {
  centerRole: 'manager' | 'staff';
  orgRole: 'co_owner' | 'manager' | 'staff';
} {
  switch (role) {
    case 'co_owner':
      return { orgRole: 'co_owner', centerRole: 'manager' };
    case 'manager':
      return { orgRole: 'manager', centerRole: 'manager' };
    case 'employee':
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
