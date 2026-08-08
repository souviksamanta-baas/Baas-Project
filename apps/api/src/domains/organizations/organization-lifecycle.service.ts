import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  assertOrgMembership,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class OrganizationLifecycleService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listMembers(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<
    Array<{
      displayName: string;
      email: string | null;
      phoneE164: string | null;
      role: string;
      userId: string;
    }>
  > {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_members')
      .select('id, user_id, role')
      .eq('organization_id', params.organizationId);

    if (error) {
      throw new Error(`Failed to list members: ${error.message}`);
    }

    const memberRows = data ?? [];
    const memberIds = memberRows.map((row) => row.id as string);

    const centerRoleByMemberId = new Map<string, 'manager' | 'staff'>();
    if (memberIds.length > 0) {
      const { data: centerRows, error: centerError } = await client
        .from('business_center_members')
        .select('organization_member_id, role')
        .eq('organization_id', params.organizationId)
        .in('organization_member_id', memberIds);

      if (centerError) {
        throw new Error(`Failed to list center roles: ${centerError.message}`);
      }

      for (const centerRow of centerRows ?? []) {
        const memberId = centerRow.organization_member_id as string;
        const centerRole = centerRow.role === 'manager' ? 'manager' : 'staff';
        const current = centerRoleByMemberId.get(memberId);
        if (!current || (centerRole === 'manager' && current !== 'manager')) {
          centerRoleByMemberId.set(memberId, centerRole);
        }
      }
    }

    const inviteNameByPhone = new Map<string, string>();
    const { data: invites } = await client
      .from('organization_invites')
      .select('invited_phone_e164, invited_display_name')
      .eq('organization_id', params.organizationId)
      .not('accepted_at', 'is', null);

    for (const invite of invites ?? []) {
      const phone = String(invite.invited_phone_e164 ?? '').trim();
      const name = String(invite.invited_display_name ?? '').trim();
      if (phone && name && !inviteNameByPhone.has(phone)) {
        inviteNameByPhone.set(phone, name);
      }
    }

    const members: Array<{
      displayName: string;
      email: string | null;
      phoneE164: string | null;
      role: string;
      userId: string;
    }> = [];

    for (const row of memberRows) {
      const memberId = row.id as string;
      const userId = row.user_id as string;
      const orgRole = row.role as string;
      const centerRole = centerRoleByMemberId.get(memberId);
      const role =
        orgRole === 'owner' ? 'owner' : centerRole === 'manager' ? 'manager' : 'staff';

      let displayName = 'Miembro';
      let email: string | null = null;
      let phoneE164: string | null = null;

      const { data: userData } = await client.auth.admin.getUserById(userId);
      if (userData?.user) {
        const metadata = (userData.user.user_metadata ?? {}) as {
          auth_phone?: unknown;
          full_name?: unknown;
          name?: unknown;
        };
        const fullName = String(metadata.full_name ?? metadata.name ?? '').trim();
        const rawEmail = userData.user.email?.trim() || null;
        email = rawEmail && !isSyntheticAuthEmail(rawEmail) ? rawEmail : null;
        phoneE164 =
          normalizeMemberPhone(userData.user.phone) ??
          normalizeMemberPhone(metadata.auth_phone) ??
          null;
        const inviteName = phoneE164 ? inviteNameByPhone.get(phoneE164) : undefined;
        displayName = fullName || inviteName || email || phoneE164 || 'Miembro';
      }

      members.push({ displayName, email, phoneE164, role, userId });
    }

    members.sort((a, b) => {
      const rank = (role: string): number => {
        if (role === 'owner') return 0;
        if (role === 'manager') return 1;
        return 2;
      };
      const rankDiff = rank(a.role) - rank(b.role);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return a.displayName.localeCompare(b.displayName, 'es');
    });

    return members;
  }

  async archiveOrganization(params: {
    authorizationHeader: string | undefined;
    confirmation: string;
    organizationId: string;
  }): Promise<{ archivedAt: string }> {
    this.assertConfirmation(params.confirmation, 'ARCHIVAR');
    const user = await this.assertOwner(params);

    const client = this.supabaseService.getServiceRoleClient();
    const archivedAt = new Date().toISOString();

    const { error } = await client
      .from('organizations')
      .update({ archived_at: archivedAt, archived_by: user.id })
      .eq('id', params.organizationId)
      .is('archived_at', null);

    if (error) {
      throw new Error(`Failed to archive organization: ${error.message}`);
    }

    await client
      .from('business_centers')
      .update({ is_active: false })
      .eq('organization_id', params.organizationId);

    await client
      .from('whatsapp_config')
      .update({
        connection_status: 'disabled',
        disconnected_at: archivedAt,
      })
      .eq('organization_id', params.organizationId);

    await client
      .from('instagram_config')
      .update({
        connection_status: 'disabled',
        disconnected_at: archivedAt,
      })
      .eq('organization_id', params.organizationId);

    await client
      .from('organization_invites')
      .update({ revoked_at: archivedAt })
      .eq('organization_id', params.organizationId)
      .is('accepted_at', null)
      .is('revoked_at', null);

    await client.from('owner_device_tokens').delete().eq('organization_id', params.organizationId);

    return { archivedAt };
  }

  async deleteOrganization(params: {
    authorizationHeader: string | undefined;
    confirmation: string;
    organizationId: string;
  }): Promise<{ deleted: true }> {
    this.assertConfirmation(params.confirmation, 'ELIMINAR');
    await this.assertOwner(params);

    const client = this.supabaseService.getServiceRoleClient();
    const { data: members, error: membersError } = await client
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', params.organizationId);

    if (membersError) {
      throw new Error(`Failed to list members before delete: ${membersError.message}`);
    }

    const memberUserIds = [
      ...new Set((members ?? []).map((row) => String(row.user_id)).filter(Boolean)),
    ];

    // Cascade from organizations covers DB tenants; storage objects cleaned best-effort.
    await this.purgeOrgStorage(params.organizationId);

    const { error } = await client.from('organizations').delete().eq('id', params.organizationId);
    if (error) {
      throw new Error(`Failed to delete organization: ${error.message}`);
    }

    // Ley 25.326 art. 4.7 / 16: destroy personal login data when no longer necessary
    // (no remaining org membership). Skip users who still belong to another negocio.
    await this.purgeOrphanAuthUsers(memberUserIds);

    return { deleted: true };
  }

  async leaveOrganization(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<{ left: true }> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    if (role === 'owner') {
      const owners = await this.countOwners(params.organizationId);
      if (owners <= 1) {
        throw new BadRequestException(
          'Sos el único dueño. Transferí la propiedad o archivá/eliminá el negocio antes de salir.',
        );
      }
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data: memberRow } = await client
      .from('organization_members')
      .select('id')
      .eq('organization_id', params.organizationId)
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>();

    if (memberRow) {
      await client
        .from('business_center_members')
        .delete()
        .eq('organization_id', params.organizationId)
        .eq('organization_member_id', memberRow.id);
    }

    const { error } = await client
      .from('organization_members')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to leave organization: ${error.message}`);
    }

    await this.purgeOrphanAuthUsers([user.id]);

    return { left: true };
  }

  async transferOwnership(params: {
    authorizationHeader: string | undefined;
    newOwnerUserId: string;
    organizationId: string;
  }): Promise<{ transferred: true }> {
    const user = await this.assertOwner(params);

    if (params.newOwnerUserId === user.id) {
      throw new BadRequestException('Ya sos el dueño de este negocio.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data: target, error: targetError } = await client
      .from('organization_members')
      .select('role')
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.newOwnerUserId)
      .maybeSingle<{ role: string }>();

    if (targetError) {
      throw new Error(targetError.message);
    }

    if (!target) {
      throw new NotFoundException('El usuario destino no es miembro del negocio.');
    }

    const { error: promoteError } = await client
      .from('organization_members')
      .update({ role: 'owner' })
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.newOwnerUserId);

    if (promoteError) {
      throw new Error(promoteError.message);
    }

    const { error: demoteError } = await client
      .from('organization_members')
      .update({ role: 'staff' })
      .eq('organization_id', params.organizationId)
      .eq('user_id', user.id);

    if (demoteError) {
      throw new Error(demoteError.message);
    }

    return { transferred: true };
  }

  async removeMember(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
    userId: string;
  }): Promise<{ removed: true }> {
    const actor = await this.assertOwner(params);

    if (params.userId === actor.id) {
      throw new BadRequestException('No podés removerte a vos mismo. Usá salir del negocio.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data: memberRow, error: memberLookupError } = await client
      .from('organization_members')
      .select('id')
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId)
      .maybeSingle<{ id: string }>();

    if (memberLookupError) {
      throw new Error(`Failed to load member: ${memberLookupError.message}`);
    }

    if (!memberRow) {
      throw new NotFoundException('Ese miembro no pertenece al negocio.');
    }

    const { error: centerError } = await client
      .from('business_center_members')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('organization_member_id', memberRow.id);

    if (centerError) {
      throw new Error(`Failed to remove center membership: ${centerError.message}`);
    }

    const { error } = await client
      .from('organization_members')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId);

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`);
    }

    // Ley 25.326: destroy login when it no longer belongs to any negocio.
    await this.purgeOrphanAuthUsers([params.userId]);

    return { removed: true };
  }

  async exportOrganizationData(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<Record<string, unknown>> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    if (role !== 'owner') {
      throw new ForbiddenException('Solo el dueño puede exportar los datos del negocio.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const [org, members, centers, contacts, conversations, products] = await Promise.all([
      client.from('organizations').select('*').eq('id', params.organizationId).maybeSingle(),
      client.from('organization_members').select('user_id, role, created_at').eq('organization_id', params.organizationId),
      client.from('business_centers').select('id, name, timezone, is_default, is_active').eq('organization_id', params.organizationId),
      client.from('contacts').select('id, channel, external_contact_id, display_name, lead_status, created_at').eq('organization_id', params.organizationId).limit(5000),
      client.from('conversations').select('id, channel, status, external_contact_id, created_at').eq('organization_id', params.organizationId).limit(5000),
      client.from('products').select('id, name, sku, is_active, unit_price_cents').eq('organization_id', params.organizationId).limit(5000),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      organization: org.data,
      members: members.data,
      businessCenters: centers.data,
      contacts: contacts.data,
      conversations: conversations.data,
      products: products.data,
      note: 'Exportación Ley 25.326 / AAIP (KAN-363). Mensajes y medios se pueden ampliar en una versión posterior.',
    };
  }

  async deleteAccount(params: {
    authorizationHeader: string | undefined;
    confirmation: string;
  }): Promise<{ deleted: true }> {
    this.assertConfirmation(params.confirmation, 'ELIMINAR');
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const client = this.supabaseService.getServiceRoleClient();

    const { data: memberships, error } = await client
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message);
    }

    const soleOwnerOrgIds: string[] = [];

    for (const membership of memberships ?? []) {
      const organizationId = membership.organization_id as string;
      if (membership.role === 'owner') {
        const owners = await this.countOwners(organizationId);
        if (owners <= 1) {
          soleOwnerOrgIds.push(organizationId);
          continue;
        }
        throw new BadRequestException(
          'Transferí la propiedad de tus negocios con otros dueños antes de borrar la cuenta.',
        );
      }

      await this.leaveOrganization({
        authorizationHeader: params.authorizationHeader,
        organizationId,
      });
    }

    const orphanCandidates = new Set<string>([user.id]);

    for (const organizationId of soleOwnerOrgIds) {
      const { data: members } = await client
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId);

      for (const row of members ?? []) {
        orphanCandidates.add(String(row.user_id));
      }

      await this.purgeOrgStorage(organizationId);
      await client.from('organizations').delete().eq('id', organizationId);
    }

    await this.purgeOrphanAuthUsers([...orphanCandidates]);

    // Owner may already have been removed as an orphan; ignore "user not found".
    const { error: deleteError } = await client.auth.admin.deleteUser(user.id);
    if (deleteError && !/not found|User not found/i.test(deleteError.message)) {
      throw new Error(`Failed to delete auth user: ${deleteError.message}`);
    }

    return { deleted: true };
  }

  private assertConfirmation(value: string, expected: string): void {
    if (value.trim().toUpperCase() !== expected) {
      throw new BadRequestException(`Escribí ${expected} para confirmar.`);
    }
  }

  private async assertOwner(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<{ id: string }> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    if (role !== 'owner') {
      throw new ForbiddenException('Solo el dueño puede realizar esta acción.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data } = await client
      .from('organizations')
      .select('id, archived_at')
      .eq('id', params.organizationId)
      .maybeSingle<{ archived_at: string | null; id: string }>();

    if (!data) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    return user;
  }

  private async countOwners(organizationId: string): Promise<number> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('role', 'owner');

    if (error) {
      throw new Error(error.message);
    }

    return data?.length ?? 0;
  }

  private async purgeOrphanAuthUsers(userIds: string[]): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();

    for (const userId of userIds) {
      const { count, error: countError } = await client
        .from('organization_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        console.error(
          `[org-lifecycle] Failed to check memberships for ${userId}: ${countError.message}`,
        );
        continue;
      }

      if ((count ?? 0) > 0) {
        continue;
      }

      const { data: userData } = await client.auth.admin.getUserById(userId);
      const email = userData?.user?.email?.trim().toLowerCase() || null;
      const phoneDigits = String(userData?.user?.phone ?? '')
        .replace(/\D/g, '')
        .trim();

      if (email) {
        await client.from('auth_otp_challenges').delete().eq('email', email).eq('channel', 'email');
      }

      if (phoneDigits) {
        const phoneE164 = phoneDigits.startsWith('54') ? `+${phoneDigits}` : `+${phoneDigits}`;
        await client
          .from('auth_otp_challenges')
          .delete()
          .eq('phone_e164', phoneE164)
          .eq('channel', 'whatsapp');
      }

      const { error: deleteError } = await client.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error(`[org-lifecycle] Failed to delete orphan auth user ${userId}: ${deleteError.message}`);
      }
    }
  }

  private async purgeOrgStorage(organizationId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    try {
      const { data } = await client.storage.from('whatsapp-media').list(organizationId, { limit: 100 });
      if (data && data.length > 0) {
        await client.storage
          .from('whatsapp-media')
          .remove(data.map((entry) => `${organizationId}/${entry.name}`));
      }
    } catch {
      // Best-effort; cascade delete still removes DB rows.
    }
  }
}

function isSyntheticAuthEmail(email: string): boolean {
  return /@auth\.nexolia\.app$/i.test(email.trim());
}

function normalizeMemberPhone(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  return digits ? `+${digits}` : null;
}
