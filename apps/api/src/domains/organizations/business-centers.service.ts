import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  assertOrgMembership,
  assertOwnerOrCoOwnerRole,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';

export type BusinessCenterDto = {
  id: string;
  isActive: boolean;
  isDefault: boolean;
  name: string;
  organizationId: string;
  timezone: string;
};

type BusinessCenterRow = {
  id: string;
  is_active: boolean;
  is_default: boolean;
  name: string;
  organization_id: string;
  timezone: string;
};

function mapCenter(row: BusinessCenterRow): BusinessCenterDto {
  return {
    id: row.id,
    isActive: row.is_active,
    isDefault: row.is_default,
    name: row.name,
    organizationId: row.organization_id,
    timezone: row.timezone,
  };
}

@Injectable()
export class BusinessCentersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listCenters(params: {
    authorizationHeader?: string;
    organizationId: string;
  }): Promise<BusinessCenterDto[]> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id, organization_id, name, timezone, is_default, is_active')
      .eq('organization_id', params.organizationId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return ((data ?? []) as BusinessCenterRow[]).map(mapCenter);
  }

  async createCenter(params: {
    authorizationHeader?: string;
    name: string;
    organizationId: string;
    timezone?: string | null;
  }): Promise<BusinessCenterDto> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    assertOwnerOrCoOwnerRole(role);
    await this.assertMultiSucursalesEnabled(params.organizationId);

    const name = params.name.trim();
    if (!name) {
      throw new BadRequestException('El nombre de la sucursal es obligatorio.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const timezone =
      params.timezone?.trim() ||
      (await this.getOrgTimezone(params.organizationId)) ||
      'America/Argentina/Cordoba';

    const { data, error } = await client
      .from('business_centers')
      .insert({
        is_active: true,
        is_default: false,
        name,
        organization_id: params.organizationId,
        timezone,
      })
      .select('id, organization_id, name, timezone, is_default, is_active')
      .single<BusinessCenterRow>();

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'No se pudo crear la sucursal.');
    }

    return mapCenter(data);
  }

  async updateCenter(params: {
    authorizationHeader?: string;
    businessCenterId: string;
    isActive?: boolean;
    name?: string;
    organizationId: string;
    timezone?: string;
  }): Promise<BusinessCenterDto> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    assertOwnerOrCoOwnerRole(role);
    await this.assertMultiSucursalesEnabled(params.organizationId);

    const existing = await this.getCenterOrThrow(
      params.organizationId,
      params.businessCenterId,
    );

    const patch: Record<string, unknown> = {};
    if (params.name !== undefined) {
      const name = params.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre de la sucursal es obligatorio.');
      }
      patch.name = name;
    }
    if (params.timezone !== undefined) {
      const timezone = params.timezone.trim();
      if (!timezone) {
        throw new BadRequestException('La zona horaria es obligatoria.');
      }
      patch.timezone = timezone;
    }
    if (params.isActive !== undefined) {
      if (!params.isActive && existing.is_default) {
        throw new BadRequestException(
          'No podés desactivar la sucursal principal. Primero elegí otra como principal.',
        );
      }
      patch.is_active = params.isActive;
    }

    if (Object.keys(patch).length === 0) {
      return mapCenter(existing);
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .update(patch)
      .eq('organization_id', params.organizationId)
      .eq('id', params.businessCenterId)
      .select('id, organization_id, name, timezone, is_default, is_active')
      .single<BusinessCenterRow>();

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'No se pudo actualizar la sucursal.');
    }

    return mapCenter(data);
  }

  async setDefaultCenter(params: {
    authorizationHeader?: string;
    businessCenterId: string;
    organizationId: string;
  }): Promise<BusinessCenterDto> {
    const user = await resolveAuthUser(
      this.supabaseService,
      params.authorizationHeader,
    );
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    assertOwnerOrCoOwnerRole(role);
    await this.assertMultiSucursalesEnabled(params.organizationId);

    const existing = await this.getCenterOrThrow(
      params.organizationId,
      params.businessCenterId,
    );
    if (!existing.is_active) {
      throw new BadRequestException('La sucursal debe estar activa para ser principal.');
    }
    if (existing.is_default) {
      return mapCenter(existing);
    }

    const client = this.supabaseService.getServiceRoleClient();

    const { error: clearError } = await client
      .from('business_centers')
      .update({ is_default: false })
      .eq('organization_id', params.organizationId)
      .eq('is_default', true);

    if (clearError) {
      throw new BadRequestException(clearError.message);
    }

    const { data, error } = await client
      .from('business_centers')
      .update({ is_default: true, is_active: true })
      .eq('organization_id', params.organizationId)
      .eq('id', params.businessCenterId)
      .select('id, organization_id, name, timezone, is_default, is_active')
      .single<BusinessCenterRow>();

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'No se pudo marcar como principal.');
    }

    return mapCenter(data);
  }

  private async getCenterOrThrow(
    organizationId: string,
    businessCenterId: string,
  ): Promise<BusinessCenterRow> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id, organization_id, name, timezone, is_default, is_active')
      .eq('organization_id', organizationId)
      .eq('id', businessCenterId)
      .maybeSingle<BusinessCenterRow>();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Sucursal no encontrada.');
    }
    return data;
  }

  private async getOrgTimezone(organizationId: string): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data } = await client
      .from('organizations')
      .select('timezone')
      .eq('id', organizationId)
      .maybeSingle<{ timezone: string }>();
    return data?.timezone ?? null;
  }

  private async assertMultiSucursalesEnabled(organizationId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select('feature_flags, plan_id, plans(slug)')
      .eq('id', organizationId)
      .maybeSingle<{
        feature_flags: Record<string, boolean> | null;
        plan_id: string | null;
        plans: { slug: string } | { slug: string }[] | null;
      }>();

    if (error) {
      throw new BadRequestException(error.message);
    }

    const planRelation = data?.plans;
    const planSlug = Array.isArray(planRelation)
      ? planRelation[0]?.slug
      : planRelation?.slug;
    const flags = data?.feature_flags ?? {};
    const entitled =
      flags.multi_sucursales === true ||
      planSlug === 'enterprise' ||
      planSlug === 'max' ||
      planSlug === 'advanced';

    if (!entitled) {
      throw new ForbiddenException(
        'Multisucursal no está habilitado para este negocio (plan Enterprise).',
      );
    }
  }
}
