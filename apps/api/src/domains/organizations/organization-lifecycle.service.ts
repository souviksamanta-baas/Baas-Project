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
  }): Promise<Array<{ role: string; userId: string }>> {
    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', params.organizationId);

    if (error) {
      throw new Error(`Failed to list members: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      role: row.role as string,
      userId: row.user_id as string,
    }));
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

    // Cascade from organizations covers DB tenants; storage objects cleaned best-effort.
    await this.purgeOrgStorage(params.organizationId);

    const { error } = await client.from('organizations').delete().eq('id', params.organizationId);
    if (error) {
      throw new Error(`Failed to delete organization: ${error.message}`);
    }

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
    const { data: centers } = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', params.organizationId);
    const centerIds = (centers ?? []).map((row) => row.id as string);
    if (centerIds.length > 0) {
      await client
        .from('business_center_members')
        .delete()
        .eq('user_id', user.id)
        .in('business_center_id', centerIds);
    }

    const { error } = await client
      .from('organization_members')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to leave organization: ${error.message}`);
    }

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
    const centers = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', params.organizationId);

    const centerIds = (centers.data ?? []).map((row) => row.id as string);
    if (centerIds.length > 0) {
      await client
        .from('business_center_members')
        .delete()
        .eq('user_id', params.userId)
        .in('business_center_id', centerIds);
    }

    const { error } = await client
      .from('organization_members')
      .delete()
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId);

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`);
    }

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
      note: 'Exportación GDPR preliminar (KAN-363). Mensajes y medios se pueden ampliar en una versión posterior.',
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

    for (const membership of memberships ?? []) {
      const organizationId = membership.organization_id as string;
      if (membership.role === 'owner') {
        const owners = await this.countOwners(organizationId);
        if (owners <= 1) {
          await this.purgeOrgStorage(organizationId);
          await client.from('organizations').delete().eq('id', organizationId);
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

    const { error: deleteError } = await client.auth.admin.deleteUser(user.id);
    if (deleteError) {
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
