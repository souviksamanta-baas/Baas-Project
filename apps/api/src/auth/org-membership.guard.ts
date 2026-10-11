import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SupabaseService } from '../supabase/supabase.service';
import { IS_PUBLIC_KEY, SKIP_ORG_MEMBERSHIP_KEY } from './auth.decorators';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { assertOrgMembership, resolveAuthUser } from './request-auth.helper';

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipOrg = this.reflector.getAllAndOverride<boolean>(SKIP_ORG_MEMBERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || skipOrg) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = extractOrganizationId(request);
    if (!organizationId) {
      return true;
    }

    const user =
      request.user ??
      (await resolveAuthUser(this.supabaseService, request.headers.authorization));
    request.user = user;
    await assertOrgMembership({
      organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    await assertOrganizationUsable(this.supabaseService, organizationId);
    return true;
  }
}

async function assertOrganizationUsable(
  supabaseService: SupabaseService,
  organizationId: string,
): Promise<void> {
  const client = supabaseService.getServiceRoleClient();
  const { data, error } = await client
    .from('organizations')
    .select('archived_at, license_status')
    .eq('id', organizationId)
    .maybeSingle<{ archived_at: string | null; license_status: string | null }>();

  if (error) {
    throw new Error(`Failed to load organization status: ${error.message}`);
  }
  if (!data) {
    throw new ForbiddenException('Organización no encontrada.');
  }
  if (data.archived_at) {
    throw new ForbiddenException('Organización archivada.');
  }
  if (data.license_status === 'paused') {
    throw new ForbiddenException('Organización pausada.');
  }
}

export function extractOrganizationId(request: AuthenticatedRequest): string | undefined {
  const params = request.params ?? {};
  const query = request.query ?? {};
  const body = request.body as { organizationId?: unknown } | undefined;

  const candidates = [
    params.organizationId,
    typeof query.organizationId === 'string' ? query.organizationId : undefined,
    body && typeof body === 'object' ? body.organizationId : undefined,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function requireOrganizationId(organizationId: string | undefined): string {
  const value = organizationId?.trim();
  if (!value) {
    throw new BadRequestException('organizationId is required');
  }
  return value;
}
