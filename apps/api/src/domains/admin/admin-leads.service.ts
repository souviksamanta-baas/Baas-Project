import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import {
  assertNexoliaStaff,
  writeAdminAudit,
  type NexoliaStaffContext,
} from './admin-auth.helper';

export interface CreateLeadInput {
  billingCycle?: 'monthly' | 'annual';
  email: string;
  featureFlags?: Record<string, boolean>;
  marketingOptIn?: boolean;
  notes?: string;
  orgName?: string;
  planSlug?: string;
  selectedServices?: string[];
  verticalSlug?: string;
}

export interface ConvertLeadInput {
  authorizationHeader: string | undefined;
  leadId: string;
  orgName: string;
  orgTimezone?: string;
  via?: 'ui' | 'grok';
}

@Injectable()
export class AdminLeadsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createPublicLead(input: CreateLeadInput): Promise<{ id: string }> {
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email inválido');
    }

    const orgName = input.orgName?.trim() ?? '';
    if (!orgName) {
      throw new BadRequestException('Ingresá el nombre del negocio');
    }

    const selectedServices = input.selectedServices ?? [];
    const featureFlags =
      input.featureFlags && Object.keys(input.featureFlags).length > 0
        ? input.featureFlags
        : buildFeatureFlagsFromSelection(selectedServices);

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('leads')
      .insert({
        billing_cycle: input.billingCycle ?? 'monthly',
        email,
        feature_flags: featureFlags,
        marketing_opt_in: input.marketingOptIn ?? false,
        notes: input.notes ?? null,
        org_name: orgName,
        plan_slug: input.planSlug ?? null,
        selected_services: selectedServices,
        status: 'new',
        vertical_slug: input.verticalSlug ?? null,
      })
      .select('id')
      .single<{ id: string }>();

    if (error || !data) {
      throw new Error(`Failed to create lead: ${error?.message ?? 'unknown'}`);
    }

    return { id: data.id };
  }

  /**
   * Public org-name availability check for /comenzar.
   * ownedByRequester = same email already linked as registered_owner or org member.
   */
  async checkOrgName(input: {
    email?: string;
    name: string;
  }): Promise<{
    available: boolean;
    ownedByRequester: boolean;
    orgName: string;
  }> {
    const orgName = input.name.trim();
    if (!orgName) {
      throw new BadRequestException('Ingresá el nombre del negocio');
    }

    const email = (input.email ?? '').trim().toLowerCase();
    const client = this.supabaseService.getServiceRoleClient();

    const { data: orgs, error } = await client
      .from('organizations')
      .select('id, name')
      .ilike('name', orgName)
      .limit(20);

    if (error) {
      throw new Error(`Failed to check org name: ${error.message}`);
    }

    const matches = (orgs ?? []).filter(
      (row) => row.name.trim().toLowerCase() === orgName.toLowerCase(),
    );

    if (matches.length === 0) {
      return { available: true, ownedByRequester: false, orgName };
    }

    if (!email || !email.includes('@')) {
      return { available: false, ownedByRequester: false, orgName: matches[0].name };
    }

    const orgIds = matches.map((m) => m.id);

    const { data: owners } = await client
      .from('registered_owners')
      .select('organization_id, email')
      .in('organization_id', orgIds)
      .ilike('email', email);

    const ownerHit = (owners ?? []).some(
      (row) => row.email.trim().toLowerCase() === email,
    );
    if (ownerHit) {
      return { available: false, ownedByRequester: true, orgName: matches[0].name };
    }

    const { data: members } = await client
      .from('organization_members')
      .select('organization_id, user_id')
      .in('organization_id', orgIds);

    const userIds = [
      ...new Set((members ?? []).map((m) => m.user_id).filter(Boolean)),
    ] as string[];

    for (const userId of userIds) {
      const { data: userData } = await client.auth.admin.getUserById(userId);
      const memberEmail = (userData.user?.email ?? '').trim().toLowerCase();
      if (memberEmail && memberEmail === email) {
        return {
          available: false,
          ownedByRequester: true,
          orgName: matches[0].name,
        };
      }
    }

    return { available: false, ownedByRequester: false, orgName: matches[0].name };
  }

  async listLeads(authorizationHeader: string | undefined) {
    await assertNexoliaStaff(this.supabaseService, authorizationHeader);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(`Failed to list leads: ${error.message}`);
    }

    return data ?? [];
  }

  async convertLead(input: ConvertLeadInput): Promise<{ organizationId: string }> {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      input.authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();

    const { data: lead, error: leadError } = await client
      .from('leads')
      .select('*')
      .eq('id', input.leadId)
      .maybeSingle<{
        billing_cycle: string | null;
        email: string;
        feature_flags: Record<string, boolean> | null;
        id: string;
        org_name: string | null;
        organization_id: string | null;
        plan_slug: string | null;
        status: string;
        vertical_slug: string | null;
      }>();

    if (leadError) {
      throw new Error(`Failed to load lead: ${leadError.message}`);
    }
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }
    if (lead.status === 'converted' && lead.organization_id) {
      return { organizationId: lead.organization_id };
    }

    let verticalId: string | null = null;
    if (lead.vertical_slug) {
      const { data: vertical } = await client
        .from('organization_verticals')
        .select('id')
        .eq('slug', lead.vertical_slug)
        .maybeSingle<{ id: string }>();
      verticalId = vertical?.id ?? null;
    }

    let planId: string | null = null;
    let planFlags: Record<string, boolean> = {};
    if (lead.plan_slug) {
      const { data: plan } = await client
        .from('plans')
        .select('id, feature_flags')
        .eq('slug', lead.plan_slug)
        .maybeSingle<{ feature_flags: Record<string, boolean>; id: string }>();
      if (plan) {
        planId = plan.id;
        planFlags = plan.feature_flags ?? {};
      }
    }

    const mergedFlags = {
      ...planFlags,
      ...(lead.feature_flags ?? {}),
    };

    // Create org via service role (bypass RPC auth.uid requirement)
    const { data: org, error: orgError } = await client
      .from('organizations')
      .insert({
        billing_cycle: lead.billing_cycle ?? 'monthly',
        feature_flags: mergedFlags,
        license_status: 'pending_payment',
        name: (input.orgName.trim() || lead.org_name || '').trim() || 'Sin nombre',
        plan_id: planId,
        timezone: input.orgTimezone ?? 'America/Argentina/Cordoba',
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
      timezone: input.orgTimezone ?? 'America/Argentina/Cordoba',
    });

    if (centerError) {
      throw new Error(`Failed to create business center: ${centerError.message}`);
    }

    const { error: ownerError } = await client.from('registered_owners').insert({
      email: lead.email.toLowerCase(),
      organization_id: org.id,
    });

    if (ownerError) {
      throw new Error(`Failed to register owner: ${ownerError.message}`);
    }

    const { error: leadUpdateError } = await client
      .from('leads')
      .update({
        organization_id: org.id,
        status: 'converted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    if (leadUpdateError) {
      throw new Error(`Failed to update lead: ${leadUpdateError.message}`);
    }

    await writeAdminAudit({
      action: 'lead.convert',
      actorStaffId: staff.userId,
      entityId: lead.id,
      entityType: 'lead',
      payload: { organizationId: org.id, email: lead.email },
      supabaseService: this.supabaseService,
      via: input.via ?? 'ui',
    });

    return { organizationId: org.id };
  }

  async requireStaff(
    authorizationHeader: string | undefined,
  ): Promise<NexoliaStaffContext> {
    return assertNexoliaStaff(this.supabaseService, authorizationHeader);
  }
}

const SELECTABLE_FEATURE_KEYS = [
  'commerce_pos',
  'commerce_inventory',
  'commerce_lots',
  'commerce_purchases',
  'commerce_suppliers',
  'commerce_nav_shortcut',
  'billing_invoices',
  'billing_quotes',
  'billing_arca',
  'billing_cash',
  'appointments',
  'copi_pro_agent',
  'copi_voice',
  'copi_vision',
  'copi_custom_reports',
  'notifications',
  'integrations_whatsapp',
  'integrations_instagram',
  'integrations_messenger',
  'integrations_email',
  'integrations_sms',
  'multi_sucursales',
] as const;

const BASELINE_FEATURE_FLAGS: Record<string, true> = {
  account: true,
  browser_session: true,
  help_privacy: true,
  inbox: true,
  integrations: true,
  tasks: true,
  copi_enabled: true,
  copi_basic_reports: true,
  copi_freeform_questions: true,
};

function buildFeatureFlagsFromSelection(
  selected: string[],
): Record<string, boolean> {
  const selectedSet = new Set(selected);
  const flags: Record<string, boolean> = { ...BASELINE_FEATURE_FLAGS };
  for (const key of SELECTABLE_FEATURE_KEYS) {
    flags[key] = selectedSet.has(key);
  }
  return flags;
}
