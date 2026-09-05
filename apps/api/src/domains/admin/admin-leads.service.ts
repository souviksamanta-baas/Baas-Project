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
import { notifyOwnerOrgConfirmed } from './admin-mail.util';

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

  async createPublicLead(
    input: CreateLeadInput,
  ): Promise<{ id: string; organizationId: string | null }> {
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

    // Do NOT auto-provision an organization here. Staff must convert/confirm
    // the lead in the admin portal before the org exists and is "Convertido".

    try {
      await this.sendLeadConfirmationEmail({
        email,
        leadId: data.id,
        orgName,
        planSlug: input.planSlug ?? null,
      });
    } catch (err) {
      console.error(
        `[public-leads] confirmation email failed for ${redactEmail(email)}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { id: data.id, organizationId: null };
  }

  private async sendLeadConfirmationEmail(params: {
    email: string;
    leadId: string;
    orgName: string;
    planSlug: string | null;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.NEXOLIA_AUTH_EMAIL_FROM?.trim() ||
      'Nexolia <noreply@nexolia.com.ar>';

    const planLabel = planDisplayName(params.planSlug);
    const subject = `Recibimos tu solicitud — ${params.orgName}`;

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(
          `[public-leads] Dev mode — confirmation email to ${redactEmail(params.email)} skipped (no RESEND_API_KEY).`,
        );
        return;
      }
      throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject,
        html: [
          '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#101935;max-width:560px">',
          '<h2 style="margin:0 0 12px;color:#101935">¡Gracias por elegir Nexolia!</h2>',
          `<p>Recibimos el alta de <strong>${escapeHtml(params.orgName)}</strong>${
            planLabel ? ` con el plan <strong>${escapeHtml(planLabel)}</strong>` : ''
          }.</p>`,
          '<p>Nuestro equipo revisará tu solicitud y activará tu cuenta a la brevedad. Por ahora las suscripciones son <strong>gratuitas</strong>.</p>',
          `<p style="font-size:14px;color:#56627b">Referencia: <code>${escapeHtml(params.leadId)}</code></p>`,
          '<p style="font-size:14px;color:#56627b">Si no pediste este alta, podés ignorar este correo.</p>',
          '</div>',
        ].join(''),
        text: [
          '¡Gracias por elegir Nexolia!',
          '',
          `Recibimos el alta de ${params.orgName}${planLabel ? ` con el plan ${planLabel}` : ''}.`,
          'Nuestro equipo revisará tu solicitud y activará tu cuenta a la brevedad. Por ahora las suscripciones son gratuitas.',
          '',
          `Referencia: ${params.leadId}`,
        ].join('\n'),
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      name?: string;
    };
    if (!response.ok) {
      const detail = body.message || body.name || `HTTP ${response.status}`;
      throw new Error(detail);
    }
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

  /** Provision orgs for all leads that are still `new` / without organization. */
  async provisionPendingLeads(
    authorizationHeader: string | undefined,
  ): Promise<{ converted: number; failed: number }> {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      authorizationHeader,
    );
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('leads')
      .select('id, org_name')
      .is('organization_id', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      throw new Error(`Failed to list pending leads: ${error.message}`);
    }

    let converted = 0;
    let failed = 0;
    for (const lead of data ?? []) {
      try {
        const result = await this.provisionOrganizationFromLead({
          leadId: lead.id,
          orgName: lead.org_name ?? undefined,
        });
        await writeAdminAudit({
          action: 'lead.convert',
          actorStaffId: staff.userId,
          entityId: lead.id,
          entityType: 'lead',
          payload: {
            organizationId: result.organizationId,
            bulk: true,
          },
          supabaseService: this.supabaseService,
          via: 'ui',
        });
        if (result.created) {
          await notifyOwnerOrgConfirmed({
            client,
            organizationId: result.organizationId,
          });
        }
        converted += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `[admin-leads] bulk provision failed for ${lead.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return { converted, failed };
  }

  async convertLead(input: ConvertLeadInput): Promise<{ organizationId: string }> {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      input.authorizationHeader,
    );

    const result = await this.provisionOrganizationFromLead({
      leadId: input.leadId,
      orgName: input.orgName,
      orgTimezone: input.orgTimezone,
    });

    await writeAdminAudit({
      action: 'lead.convert',
      actorStaffId: staff.userId,
      entityId: input.leadId,
      entityType: 'lead',
      payload: { organizationId: result.organizationId },
      supabaseService: this.supabaseService,
      via: input.via ?? 'ui',
    });

    if (result.created) {
      await notifyOwnerOrgConfirmed({
        client: this.supabaseService.getServiceRoleClient(),
        organizationId: result.organizationId,
      });
    }

    return { organizationId: result.organizationId };
  }

  /**
   * Create org + default business center + registered owner from a lead.
   * Idempotent when the lead is already converted.
   */
  private async provisionOrganizationFromLead(input: {
    leadId: string;
    orgName?: string;
    orgTimezone?: string;
  }): Promise<{ organizationId: string; created: boolean }> {
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
      return { organizationId: lead.organization_id, created: false };
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

    const orgName =
      (input.orgName?.trim() || lead.org_name || '').trim() || 'Sin nombre';
    const timezone = input.orgTimezone ?? 'America/Argentina/Cordoba';

    // Free/trial onboarding: provision immediately without waiting for payment.
    const { data: org, error: orgError } = await client
      .from('organizations')
      .insert({
        billing_cycle: lead.billing_cycle ?? 'monthly',
        feature_flags: mergedFlags,
        license_status: 'trial',
        name: orgName,
        plan_id: planId,
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
      email: lead.email.toLowerCase(),
      organization_id: org.id,
    });

    if (ownerError) {
      throw new Error(`Failed to register owner: ${ownerError.message}`);
    }

    // If the owner already has an auth user, attach membership immediately
    // so Negocios lists the org without waiting for the next email OTP login.
    try {
      await this.claimOwnerMembershipForEmail(lead.email.toLowerCase(), org.id);
    } catch (err) {
      console.error(
        `[admin-leads] immediate owner claim failed for org ${org.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
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

    return { organizationId: org.id, created: true };
  }

  /** Link auth user (if any) as owner member of the given org. */
  private async claimOwnerMembershipForEmail(
    email: string,
    organizationId: string,
  ): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data: linkData, error: linkError } = await client.auth.admin.generateLink({
      email,
      type: 'magiclink',
    });
    const user = linkData?.user;
    if (linkError || !user) {
      return;
    }

    const now = new Date().toISOString();
    await client
      .from('registered_owners')
      .update({
        claimed_at: now,
        updated_at: now,
        user_id: user.id,
      })
      .eq('organization_id', organizationId)
      .ilike('email', email);

    const { data: existing } = await client
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>();

    let memberId = existing?.id;
    if (!memberId) {
      const { data: member, error: memberError } = await client
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          role: 'owner',
          user_id: user.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (memberError || !member) {
        return;
      }
      memberId = member.id;
    }

    const { data: centers } = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .limit(1);

    const defaultCenterId = centers?.[0]?.id;
    if (!defaultCenterId) {
      return;
    }

    await client.from('business_center_members').upsert(
      {
        business_center_id: defaultCenterId,
        organization_id: organizationId,
        organization_member_id: memberId,
        role: 'manager',
      },
      {
        onConflict: 'organization_id,business_center_id,organization_member_id',
        ignoreDuplicates: true,
      },
    );
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

function planDisplayName(slug: string | null): string {
  switch ((slug ?? '').trim().toLowerCase()) {
    case 'basico':
      return 'Básico';
    case 'pro':
      return 'Pro';
    case 'max':
    case 'advanced':
      return 'Max';
    case 'starter':
      return 'Starter';
    default:
      return slug?.trim() ?? '';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
