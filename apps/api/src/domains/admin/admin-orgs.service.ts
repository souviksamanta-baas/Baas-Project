import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { OrganizationLlmCredentialsService } from '../ai/organization-llm-credentials.service';
import {
  applyPlanEntitlements,
  mergeLeadAndPlanFeatureFlags,
} from '../organizations/organization-feature-flags.util';
import { OrganizationLifecycleService } from '../organizations/organization-lifecycle.service';
import {
  assertNexoliaStaff,
  requireSuperAdmin,
  writeAdminAudit,
} from './admin-auth.helper';
import { notifyOwnerOrgConfirmed } from './admin-mail.util';

const LICENSE_STATUSES = new Set([
  'pending_payment',
  'trial',
  'active',
  'paused',
  'expired',
]);

@Injectable()
export class AdminOrgsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly lifecycleService: OrganizationLifecycleService,
    private readonly llmCredentialsService: OrganizationLlmCredentialsService,
  ) {}

  async listOrganizations(authorizationHeader: string | undefined) {
    await assertNexoliaStaff(this.supabaseService, authorizationHeader);
    // Keep list fresh: trials past licensed_until become pending_payment.
    await this.expireEndedTrials();
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select(
        'id, name, license_status, licensed_until, billing_cycle, plan_id, archived_at, created_at, plans(slug, display_name, price_ars_monthly, price_ars_annual), registered_owners(email, claimed_at, user_id), organization_members(user_id)',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(`Failed to list organizations: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Tombstones of hard-deleted orgs from admin_audit_log (Ley 25.326: keep
   * minimal admin history, not the full tenant with personal data).
   */
  async listDeletedOrganizationTombstones(authorizationHeader: string | undefined) {
    await assertNexoliaStaff(this.supabaseService, authorizationHeader);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('admin_audit_log')
      .select('id, entity_id, payload, created_at')
      .eq('action', 'org.delete')
      .eq('entity_type', 'organization')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(`Failed to list deleted organizations: ${error.message}`);
    }

    return data ?? [];
  }

  async getOrganization(
    authorizationHeader: string | undefined,
    organizationId: string,
  ) {
    await assertNexoliaStaff(this.supabaseService, authorizationHeader);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select(
        '*, plans(*), registered_owners(*), organization_members(user_id, role), license_payments(*)',
      )
      .eq('id', organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get organization: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException('Organización no encontrada');
    }

    return data;
  }

  async createOrganization(params: {
    authorizationHeader: string | undefined;
    billingCycle?: 'monthly' | 'annual';
    name: string;
    ownerEmail: string;
    planId?: string | null;
    timezone?: string;
    verticalSlug?: string | null;
    via?: 'ui' | 'grok';
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    const name = params.name.trim();
    const ownerEmail = params.ownerEmail.trim().toLowerCase();
    if (!name) {
      throw new BadRequestException('Nombre de organización requerido');
    }
    if (!ownerEmail.includes('@')) {
      throw new BadRequestException('Email del propietario inválido');
    }

    const client = this.supabaseService.getServiceRoleClient();
    let verticalId: string | null = null;
    if (params.verticalSlug) {
      const { data: vertical } = await client
        .from('organization_verticals')
        .select('id')
        .eq('slug', params.verticalSlug)
        .maybeSingle<{ id: string }>();
      verticalId = vertical?.id ?? null;
    }

    let featureFlags: Record<string, boolean> = {};
    if (params.planId) {
      const { data: plan } = await client
        .from('plans')
        .select('slug, feature_flags')
        .eq('id', params.planId)
        .maybeSingle<{ feature_flags: Record<string, boolean>; slug: string }>();
      featureFlags = applyPlanEntitlements({
        flags: plan?.feature_flags ?? {},
        planSlug: plan?.slug,
      });
    }

    const timezone = params.timezone ?? 'America/Argentina/Cordoba';
    const { data: org, error: orgError } = await client
      .from('organizations')
      .insert({
        billing_cycle: params.billingCycle ?? 'monthly',
        feature_flags: featureFlags,
        license_status: 'pending_payment',
        name,
        plan_id: params.planId ?? null,
        timezone,
        vertical_id: verticalId,
      })
      .select('id')
      .single<{ id: string }>();

    if (orgError || !org) {
      throw new Error(`Failed to create organization: ${orgError?.message ?? 'unknown'}`);
    }

    const { error: centerError } = await client.from('business_centers').insert({
      code: 'main',
      is_active: true,
      is_default: true,
      name: 'Principal',
      organization_id: org.id,
      timezone,
    });

    if (centerError) {
      throw new Error(`Failed to create business center: ${centerError.message}`);
    }

    const { error: ownerError } = await client.from('registered_owners').insert({
      email: ownerEmail,
      organization_id: org.id,
    });

    if (ownerError) {
      throw new Error(`Failed to register owner: ${ownerError.message}`);
    }

    await writeAdminAudit({
      action: 'org.create',
      actorStaffId: staff.userId,
      entityId: org.id,
      entityType: 'organization',
      payload: { name, ownerEmail },
      supabaseService: this.supabaseService,
      via: params.via ?? 'ui',
    });

    // Pending payment / not confirmed yet — owner email goes out on license activation.
    return { organizationId: org.id };
  }

  async updateLicense(params: {
    authorizationHeader: string | undefined;
    billingCycle?: 'monthly' | 'annual';
    licensedUntil?: string | null;
    licenseStatus?: string;
    organizationId: string;
    planId?: string | null;
    via?: 'ui' | 'grok';
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();

    const { data: before } = await client
      .from('organizations')
      .select('license_status, feature_flags')
      .eq('id', params.organizationId)
      .maybeSingle<{
        feature_flags: Record<string, boolean> | null;
        license_status: string | null;
      }>();

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (params.licenseStatus !== undefined) {
      patch.license_status = params.licenseStatus;
    }
    if (params.licensedUntil !== undefined) {
      patch.licensed_until = params.licensedUntil;
    }
    if (params.billingCycle !== undefined) {
      patch.billing_cycle = params.billingCycle;
    }
    if (params.planId !== undefined) {
      patch.plan_id = params.planId;
      if (params.planId) {
        const { data: plan } = await client
          .from('plans')
          .select('slug, feature_flags')
          .eq('id', params.planId)
          .maybeSingle<{ feature_flags: Record<string, boolean>; slug: string }>();
        if (plan) {
          patch.feature_flags = mergeLeadAndPlanFeatureFlags({
            leadFlags: before?.feature_flags,
            planFlags: plan.feature_flags ?? {},
            planSlug: plan.slug,
          });
        }
      }
    }

    const { data, error } = await client
      .from('organizations')
      .update(patch)
      .eq('id', params.organizationId)
      .select('id')
      .single<{ id: string }>();

    if (error || !data) {
      throw new Error(`Failed to update license: ${error?.message ?? 'unknown'}`);
    }

    await writeAdminAudit({
      action: 'org.license.update',
      actorStaffId: staff.userId,
      entityId: params.organizationId,
      entityType: 'organization',
      payload: patch,
      supabaseService: this.supabaseService,
      via: params.via ?? 'ui',
    });

    const becameActive =
      params.licenseStatus === 'active' && before?.license_status !== 'active';
    if (becameActive) {
      await notifyOwnerOrgConfirmed({
        client,
        organizationId: params.organizationId,
      });
    }

    return { organizationId: data.id };
  }

  /**
   * Move trial orgs whose trial window ended (or never had licensed_until)
   * to pending_payment so staff can confirm payment → active.
   */
  async expireEndedTrials(now = new Date()): Promise<{ updated: number }> {
    const client = this.supabaseService.getServiceRoleClient();
    const nowIso = now.toISOString();
    const patch = {
      license_status: 'pending_payment',
      updated_at: nowIso,
    };

    const [due, missingUntil] = await Promise.all([
      client
        .from('organizations')
        .update(patch)
        .eq('license_status', 'trial')
        .lte('licensed_until', nowIso)
        .is('archived_at', null)
        .select('id'),
      client
        .from('organizations')
        .update(patch)
        .eq('license_status', 'trial')
        .is('licensed_until', null)
        .is('archived_at', null)
        .select('id'),
    ]);

    if (due.error) {
      throw new Error(`Failed to expire trials: ${due.error.message}`);
    }
    if (missingUntil.error) {
      throw new Error(
        `Failed to expire trials without end date: ${missingUntil.error.message}`,
      );
    }

    const ids = new Set([
      ...(due.data ?? []).map((row) => row.id as string),
      ...(missingUntil.data ?? []).map((row) => row.id as string),
    ]);
    return { updated: ids.size };
  }

  async pauseOrganization(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();
    const { data: org, error } = await client
      .from('organizations')
      .select('id, name, license_status, license_status_before_pause, archived_at')
      .eq('id', params.organizationId)
      .maybeSingle<{
        archived_at: string | null;
        id: string;
        license_status: string;
        license_status_before_pause: string | null;
        name: string;
      }>();

    if (error) {
      throw new Error(`Failed to load organization: ${error.message}`);
    }
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }
    if (org.archived_at) {
      throw new BadRequestException('La organización está archivada.');
    }

    if (org.license_status === 'paused') {
      return {
        archivedAt: org.archived_at,
        id: org.id,
        name: org.name,
        status: org.license_status,
      };
    }

    const { error: updateError } = await client
      .from('organizations')
      .update({
        license_status: 'paused',
        license_status_before_pause: LICENSE_STATUSES.has(org.license_status)
          ? org.license_status
          : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.organizationId);

    if (updateError) {
      throw new Error(`Failed to pause organization: ${updateError.message}`);
    }

    await writeAdminAudit({
      action: 'org.pause',
      actorStaffId: staff.userId,
      entityId: params.organizationId,
      entityType: 'organization',
      payload: { previousStatus: org.license_status },
      supabaseService: this.supabaseService,
    });

    return {
      archivedAt: null as string | null,
      id: org.id,
      name: org.name,
      status: 'paused',
    };
  }

  async resumeOrganization(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();
    const { data: org, error } = await client
      .from('organizations')
      .select('id, name, license_status, license_status_before_pause, archived_at')
      .eq('id', params.organizationId)
      .maybeSingle<{
        archived_at: string | null;
        id: string;
        license_status: string;
        license_status_before_pause: string | null;
        name: string;
      }>();

    if (error) {
      throw new Error(`Failed to load organization: ${error.message}`);
    }
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }
    if (org.archived_at) {
      throw new BadRequestException('La organización está archivada.');
    }
    if (org.license_status !== 'paused') {
      return {
        archivedAt: org.archived_at,
        id: org.id,
        name: org.name,
        status: org.license_status,
      };
    }

    const restored =
      org.license_status_before_pause &&
      LICENSE_STATUSES.has(org.license_status_before_pause) &&
      org.license_status_before_pause !== 'paused'
        ? org.license_status_before_pause
        : 'active';

    const { error: updateError } = await client
      .from('organizations')
      .update({
        license_status: restored,
        license_status_before_pause: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.organizationId);

    if (updateError) {
      throw new Error(`Failed to resume organization: ${updateError.message}`);
    }

    await writeAdminAudit({
      action: 'org.resume',
      actorStaffId: staff.userId,
      entityId: params.organizationId,
      entityType: 'organization',
      payload: { restoredStatus: restored },
      supabaseService: this.supabaseService,
    });

    return {
      archivedAt: null as string | null,
      id: org.id,
      name: org.name,
      status: restored,
    };
  }

  async archiveOrganization(params: {
    authorizationHeader: string | undefined;
    confirmation: string;
    organizationId: string;
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    if (params.confirmation.trim().toUpperCase() !== 'ARCHIVAR') {
      throw new BadRequestException('Escribí ARCHIVAR para confirmar.');
    }

    const result = await this.lifecycleService.archiveOrganizationAsActor({
      actorUserId: staff.userId,
      organizationId: params.organizationId,
    });

    await writeAdminAudit({
      action: 'org.archive',
      actorStaffId: staff.userId,
      entityId: params.organizationId,
      entityType: 'organization',
      payload: { archivedAt: result.archivedAt },
      supabaseService: this.supabaseService,
    });

    return result;
  }

  async deleteOrganization(params: {
    authorizationHeader: string | undefined;
    confirmation: string;
    organizationId: string;
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    requireSuperAdmin(staff);

    const client = this.supabaseService.getServiceRoleClient();
    const { data: org, error } = await client
      .from('organizations')
      .select('id, name')
      .eq('id', params.organizationId)
      .maybeSingle<{ id: string; name: string }>();

    if (error) {
      throw new Error(`Failed to load organization: ${error.message}`);
    }
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }

    const expected = org.name.trim().toLowerCase();
    if (!expected || params.confirmation.trim().toLowerCase() !== expected) {
      throw new BadRequestException(
        `Escribí el nombre exacto de la organización (${org.name}) para confirmar.`,
      );
    }

    try {
      await this.llmCredentialsService.revoke({
        actorUserId: staff.userId,
        organizationId: params.organizationId,
      });
    } catch (revokeError) {
      // Best-effort: hard delete still proceeds if OpenAI revoke fails.
      console.error(
        `[admin-orgs] Failed to revoke LLM credentials before delete: ${
          revokeError instanceof Error ? revokeError.message : String(revokeError)
        }`,
      );
    }

    await this.lifecycleService.deleteOrganizationAsActor({
      organizationId: params.organizationId,
    });

    await writeAdminAudit({
      action: 'org.delete',
      actorStaffId: staff.userId,
      entityId: params.organizationId,
      entityType: 'organization',
      payload: { name: org.name },
      supabaseService: this.supabaseService,
    });

    return { deleted: true as const };
  }
}

@Injectable()
export class AdminPlansService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listPlans(authorizationHeader: string | undefined) {
    await assertNexoliaStaff(this.supabaseService, authorizationHeader);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('plans')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to list plans: ${error.message}`);
    }

    return data ?? [];
  }

  async updatePlan(params: {
    authorizationHeader: string | undefined;
    planId: string;
    patch: Record<string, unknown>;
    via?: 'ui' | 'grok';
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('plans')
      .update({ ...params.patch, updated_at: new Date().toISOString() })
      .eq('id', params.planId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update plan: ${error?.message ?? 'unknown'}`);
    }

    await writeAdminAudit({
      action: 'plan.update',
      actorStaffId: staff.userId,
      entityId: params.planId,
      entityType: 'plan',
      payload: params.patch,
      supabaseService: this.supabaseService,
      via: params.via ?? 'ui',
    });

    return data;
  }
}

@Injectable()
export class AdminPaymentsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listPending(authorizationHeader: string | undefined) {
    await assertNexoliaStaff(this.supabaseService, authorizationHeader);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('license_payments')
      .select('*, organizations(id, name)')
      .eq('status', 'awaiting')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to list payments: ${error.message}`);
    }

    return data ?? [];
  }

  async createPayment(params: {
    amountArs: number;
    authorizationHeader: string | undefined;
    method?: 'cash' | 'transfer';
    notes?: string;
    organizationId: string;
    reference?: string;
    via?: 'ui' | 'grok';
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    if (!Number.isFinite(params.amountArs) || params.amountArs < 0) {
      throw new BadRequestException('Monto inválido');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('license_payments')
      .insert({
        amount_ars: params.amountArs,
        method: params.method ?? 'transfer',
        notes: params.notes ?? null,
        organization_id: params.organizationId,
        reference: params.reference ?? null,
        status: 'awaiting',
      })
      .select('id')
      .single<{ id: string }>();

    if (error || !data) {
      throw new Error(`Failed to create payment: ${error?.message ?? 'unknown'}`);
    }

    await writeAdminAudit({
      action: 'payment.create',
      actorStaffId: staff.userId,
      entityId: data.id,
      entityType: 'license_payment',
      payload: { organizationId: params.organizationId, amountArs: params.amountArs },
      supabaseService: this.supabaseService,
      via: params.via ?? 'ui',
    });

    return { id: data.id };
  }

  async confirmPayment(params: {
    authorizationHeader: string | undefined;
    paymentId: string;
    via?: 'ui' | 'grok';
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();

    const { data: payment, error: loadError } = await client
      .from('license_payments')
      .select('*')
      .eq('id', params.paymentId)
      .maybeSingle<{
        id: string;
        organization_id: string;
        status: string;
      }>();

    if (loadError) {
      throw new Error(`Failed to load payment: ${loadError.message}`);
    }
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    if (payment.status === 'confirmed') {
      return { paymentId: payment.id, alreadyConfirmed: true };
    }

    const now = new Date().toISOString();
    const { error: payError } = await client
      .from('license_payments')
      .update({
        confirmed_by: staff.userId,
        received_at: now,
        status: 'confirmed',
        updated_at: now,
      })
      .eq('id', payment.id);

    if (payError) {
      throw new Error(`Failed to confirm payment: ${payError.message}`);
    }

    const licensedUntil = await this.activateOrganizationLicense({
      organizationId: payment.organization_id,
      nowIso: now,
    });

    await writeAdminAudit({
      action: 'payment.confirm',
      actorStaffId: staff.userId,
      entityId: payment.id,
      entityType: 'license_payment',
      payload: { organizationId: payment.organization_id, licensedUntil },
      supabaseService: this.supabaseService,
      via: params.via ?? 'ui',
    });

    await notifyOwnerOrgConfirmed({
      client,
      organizationId: payment.organization_id,
    });

    return { paymentId: payment.id, licensedUntil };
  }

  /**
   * Staff one-click: record payment for an org and set license_status → active.
   * Intended for pending_payment (or trial if paid early).
   */
  async confirmOrganizationPayment(params: {
    amountArs?: number;
    authorizationHeader: string | undefined;
    method?: 'cash' | 'transfer';
    notes?: string;
    organizationId: string;
    reference?: string;
    via?: 'ui' | 'grok';
  }) {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();

    const { data: org, error: orgError } = await client
      .from('organizations')
      .select(
        'id, name, license_status, billing_cycle, archived_at, plans(price_ars_monthly, price_ars_annual)',
      )
      .eq('id', params.organizationId)
      .maybeSingle<{
        archived_at: string | null;
        billing_cycle: string | null;
        id: string;
        license_status: string;
        name: string;
        plans:
          | { price_ars_annual: number | null; price_ars_monthly: number | null }
          | Array<{
              price_ars_annual: number | null;
              price_ars_monthly: number | null;
            }>
          | null;
      }>();

    if (orgError) {
      throw new Error(`Failed to load organization: ${orgError.message}`);
    }
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }
    if (org.archived_at) {
      throw new BadRequestException(
        'No se puede confirmar pago de una organización archivada.',
      );
    }
    if (
      org.license_status !== 'pending_payment' &&
      org.license_status !== 'trial'
    ) {
      throw new BadRequestException(
        'Solo se puede confirmar pago en prueba o pendiente de pago.',
      );
    }

    const plan = Array.isArray(org.plans) ? org.plans[0] : org.plans;
    const defaultAmount =
      org.billing_cycle === 'annual'
        ? (plan?.price_ars_annual ?? plan?.price_ars_monthly ?? 0)
        : (plan?.price_ars_monthly ?? 0);
    const amountArs =
      params.amountArs != null && Number.isFinite(params.amountArs)
        ? Math.round(params.amountArs)
        : Math.round(defaultAmount);
    if (amountArs < 0) {
      throw new BadRequestException('Monto inválido');
    }

    const now = new Date().toISOString();
    const { data: payment, error: payError } = await client
      .from('license_payments')
      .insert({
        amount_ars: amountArs,
        confirmed_by: staff.userId,
        method: params.method ?? 'transfer',
        notes: params.notes ?? null,
        organization_id: org.id,
        received_at: now,
        reference: params.reference ?? null,
        status: 'confirmed',
      })
      .select('id')
      .single<{ id: string }>();

    if (payError || !payment) {
      throw new Error(
        `Failed to record payment: ${payError?.message ?? 'unknown'}`,
      );
    }

    const licensedUntil = await this.activateOrganizationLicense({
      organizationId: org.id,
      nowIso: now,
    });

    await writeAdminAudit({
      action: 'payment.confirm_organization',
      actorStaffId: staff.userId,
      entityId: payment.id,
      entityType: 'license_payment',
      payload: {
        amountArs,
        licensedUntil,
        organizationId: org.id,
        previousStatus: org.license_status,
      },
      supabaseService: this.supabaseService,
      via: params.via ?? 'ui',
    });

    await notifyOwnerOrgConfirmed({
      client,
      organizationId: org.id,
    });

    return {
      licensedUntil,
      organizationId: org.id,
      paymentId: payment.id,
      status: 'active' as const,
    };
  }

  private async activateOrganizationLicense(params: {
    organizationId: string;
    nowIso: string;
  }): Promise<string> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data: org, error } = await client
      .from('organizations')
      .select('billing_cycle')
      .eq('id', params.organizationId)
      .maybeSingle<{ billing_cycle: string | null }>();

    if (error) {
      throw new Error(`Failed to load org billing cycle: ${error.message}`);
    }

    const licensedUntil = nextLicensedUntil(
      org?.billing_cycle === 'annual' ? 'annual' : 'monthly',
      new Date(params.nowIso),
    );

    const { error: orgError } = await client
      .from('organizations')
      .update({
        license_status: 'active',
        licensed_until: licensedUntil,
        updated_at: params.nowIso,
      })
      .eq('id', params.organizationId);

    if (orgError) {
      throw new Error(`Failed to activate license: ${orgError.message}`);
    }

    return licensedUntil;
  }
}

function nextLicensedUntil(
  billingCycle: 'monthly' | 'annual',
  from: Date,
): string {
  const next = new Date(from);
  if (billingCycle === 'annual') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next.toISOString();
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getKpis(authorizationHeader: string | undefined) {
    await assertNexoliaStaff(this.supabaseService, authorizationHeader);
    const client = this.supabaseService.getServiceRoleClient();

    const [
      { count: activeCount },
      { count: trialCount },
      { count: pendingPayments },
      { count: expiringSoon },
      { count: newLeads },
    ] = await Promise.all([
      client
        .from('organizations')
        .select('id', { count: 'exact', head: true })
        .eq('license_status', 'active'),
      client
        .from('organizations')
        .select('id', { count: 'exact', head: true })
        .eq('license_status', 'trial'),
      client
        .from('license_payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'awaiting'),
      client
        .from('organizations')
        .select('id', { count: 'exact', head: true })
        .eq('license_status', 'active')
        .lte(
          'licensed_until',
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        ),
      client
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new'),
    ]);

    return {
      activeLicenses: activeCount ?? 0,
      expiringSoon: expiringSoon ?? 0,
      newLeads: newLeads ?? 0,
      pendingPayments: pendingPayments ?? 0,
      trialLicenses: trialCount ?? 0,
    };
  }
}
