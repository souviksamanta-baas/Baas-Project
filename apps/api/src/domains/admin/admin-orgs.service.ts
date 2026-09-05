import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import {
  assertNexoliaStaff,
  writeAdminAudit,
} from './admin-auth.helper';
import { notifyOwnerOrgConfirmed } from './admin-mail.util';

@Injectable()
export class AdminOrgsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listOrganizations(authorizationHeader: string | undefined) {
    await assertNexoliaStaff(this.supabaseService, authorizationHeader);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select(
        'id, name, license_status, licensed_until, billing_cycle, plan_id, created_at, plans(slug, display_name), registered_owners(email, claimed_at, user_id), organization_members(user_id)',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(`Failed to list organizations: ${error.message}`);
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
        .select('feature_flags')
        .eq('id', params.planId)
        .maybeSingle<{ feature_flags: Record<string, boolean> }>();
      featureFlags = plan?.feature_flags ?? {};
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
      .select('license_status')
      .eq('id', params.organizationId)
      .maybeSingle<{ license_status: string | null }>();

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
          .select('feature_flags')
          .eq('id', params.planId)
          .maybeSingle<{ feature_flags: Record<string, boolean> }>();
        if (plan?.feature_flags) {
          patch.feature_flags = plan.feature_flags;
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

    const licensedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: orgError } = await client
      .from('organizations')
      .update({
        license_status: 'active',
        licensed_until: licensedUntil,
        updated_at: now,
      })
      .eq('id', payment.organization_id);

    if (orgError) {
      throw new Error(`Failed to activate license: ${orgError.message}`);
    }

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
