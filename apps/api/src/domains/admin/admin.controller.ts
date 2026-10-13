import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { Public, SkipOrgMembership } from '../../auth/auth.decorators';
import { assertJobSecret } from '../../auth/job-secret.util';

import { AdminGrokService } from './admin-grok.service';
import { AdminLeadsService } from './admin-leads.service';
import { AdminPasswordResetService } from './admin-password-reset.service';
import {
  AdminDashboardService,
  AdminOrgsService,
  AdminPaymentsService,
  AdminPlansService,
} from './admin-orgs.service';
import { OrganizationLlmCredentialsService } from '../ai/organization-llm-credentials.service';

const CATEGORIA_TO_SLUG: Record<string, string> = {
  Ferretería: 'ferreteria',
  Dietética: 'dietetica',
  Clínica: 'clinica',
  Veterinaria: 'veterinaria',
  Restaurante: 'restaurante',
  Taller: 'taller',
  'Servicios profesionales': 'servicios_profesionales',
};

@SkipOrgMembership()
@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly leadsService: AdminLeadsService,
    private readonly orgsService: AdminOrgsService,
    private readonly plansService: AdminPlansService,
    private readonly paymentsService: AdminPaymentsService,
    private readonly dashboardService: AdminDashboardService,
    private readonly grokService: AdminGrokService,
    private readonly llmCredentialsService: OrganizationLlmCredentialsService,
  ) {}

  @Get('me')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Current nexolia staff profile' })
  @ApiOkResponse({ description: 'Staff context.' })
  async me(@Headers('authorization') authorizationHeader: string | undefined) {
    const staff = await this.leadsService.requireStaff(authorizationHeader);
    return {
      email: staff.email,
      id: staff.userId,
      name: staff.email.split('@')[0],
      role: staff.role,
      userId: staff.userId,
    };
  }

  @Get('dashboard')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Admin dashboard KPIs' })
  async dashboard(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    const data = await this.dashboardService.getDashboard(authorizationHeader);
    return {
      activity: data.activity,
      kpis: [
        {
          label: 'Clientes activos',
          tone: 'positive',
          value: data.kpis.activeLicenses,
        },
        {
          label: 'Pendiente de pago',
          tone: 'warning',
          value: data.kpis.pendingPaymentOrgs,
        },
        {
          label: 'Leads nuevos',
          tone: 'warning',
          value: data.kpis.newLeads,
        },
        {
          label: 'Licencias por vencer',
          tone: 'warning',
          value: data.kpis.expiringSoon,
        },
      ],
      paymentsByDay: data.paymentsByDay,
      recentClients: data.recentClients,
      raw: data.kpis,
    };
  }

  @Get('users')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'List organization users (email and phone logins)' })
  async listUsers(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    return this.orgsService.listOrganizationUsers(authorizationHeader);
  }

  @Get('leads')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'List leads' })
  async listLeads(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    const rows = await this.leadsService.listLeads(authorizationHeader);
    return rows.map((row: Record<string, unknown>) => ({
      business:
        String(row.org_name ?? '').trim() ||
        String(row.email ?? '').split('@')[0],
      categoria: row.vertical_slug ?? '',
      ciclo: row.billing_cycle ?? 'monthly',
      createdAt: row.created_at,
      email: row.email,
      id: row.id,
      organizationId: row.organization_id ?? null,
      orgName: row.org_name ?? null,
      plan: row.plan_slug ?? '',
      servicios: Array.isArray(row.selected_services) ? row.selected_services : [],
      status: row.status,
    }));
  }

  @Post('leads/provision-pending')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'Create organizations for all leads without organization_id',
  })
  async provisionPendingLeads(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    return this.leadsService.provisionPendingLeads(authorizationHeader);
  }

  @Post('leads/:id/convert')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Convert lead into organization + registered owner' })
  async convertLead(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') leadId: string,
    @Body()
    body: {
      orgName?: string;
      orgTimezone?: string;
      ownerEmail?: string;
      ownerName?: string;
      plan?: string;
    },
  ) {
    const orgName =
      body.orgName?.trim() ||
      body.ownerName?.trim() ||
      body.ownerEmail?.split('@')[0] ||
      'Nueva organización';
    return this.leadsService.convertLead({
      authorizationHeader,
      leadId,
      orgName,
      orgTimezone: body.orgTimezone,
    });
  }

  @Post('leads/:id/reject')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Reject a pending lead (keeps row with rejected status)' })
  async rejectLead(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') leadId: string,
  ) {
    return this.leadsService.rejectLead({
      authorizationHeader,
      leadId,
    });
  }

  @Get('organizations')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'List organizations for staff (includes deleted tombstones from audit)',
  })
  async listOrgs(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    const [rows, deletedRows] = await Promise.all([
      this.orgsService.listOrganizations(authorizationHeader),
      this.orgsService.listDeletedOrganizationTombstones(authorizationHeader),
    ]);

    const live = rows.map((row: Record<string, unknown>) => {
      const plansRaw = row.plans as
        | {
            display_name?: string;
            price_ars_annual?: number | null;
            price_ars_monthly?: number | null;
            slug?: string;
          }
        | Array<{
            display_name?: string;
            price_ars_annual?: number | null;
            price_ars_monthly?: number | null;
            slug?: string;
          }>
        | null;
      const plans = Array.isArray(plansRaw) ? plansRaw[0] : plansRaw;
      const owners = row.registered_owners as Array<{ email?: string }> | null;
      const members = row.organization_members as Array<{ user_id?: string }> | null;
      const ownerEmail = owners?.[0]?.email?.trim() || undefined;
      const billingCycle =
        row.billing_cycle === 'annual' || row.billing_cycle === 'monthly'
          ? row.billing_cycle
          : 'monthly';
      return {
        archivedAt: (row.archived_at as string | null) ?? null,
        billingCycle,
        createdAt: (row.created_at as string | null) ?? null,
        deletedAt: null as string | null,
        id: row.id as string,
        licenseExpiresAt: row.licensed_until,
        members: Array.isArray(members) ? members.length : owners?.length ?? 0,
        name: row.name as string,
        ownerEmail,
        ownerName: ownerEmail,
        plan: plans?.display_name ?? plans?.slug ?? '',
        planPriceAnnual: plans?.price_ars_annual ?? null,
        planPriceMonthly: plans?.price_ars_monthly ?? null,
        planSlug: plans?.slug ?? '',
        status: row.license_status as string,
      };
    });

    const liveIds = new Set(live.map((org) => org.id));
    const deleted = deletedRows
      .map((row: Record<string, unknown>) => {
        const entityId = String(row.entity_id ?? '').trim();
        if (!entityId || liveIds.has(entityId)) {
          return null;
        }
        const payload = (row.payload ?? {}) as { name?: unknown };
        const name =
          typeof payload.name === 'string' && payload.name.trim()
            ? payload.name.trim()
            : 'Organización eliminada';
        return {
          archivedAt: null as string | null,
          deletedAt: (row.created_at as string | null) ?? null,
          id: entityId,
          licenseExpiresAt: null as string | null,
          members: 0,
          name,
          ownerEmail: undefined as string | undefined,
          ownerName: undefined as string | undefined,
          plan: '',
          planSlug: '',
          status: 'deleted',
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    return [...live, ...deleted];
  }

  @Post('organizations')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Create organization + registered owner' })
  async createOrg(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      billingCycle?: 'monthly' | 'annual';
      name: string;
      ownerEmail?: string;
      ownerName?: string;
      plan?: string;
      planId?: string | null;
      timezone?: string;
      verticalSlug?: string | null;
    },
  ) {
    const ownerEmail = (body.ownerEmail ?? '').trim().toLowerCase();
    return this.orgsService.createOrganization({
      authorizationHeader,
      billingCycle: body.billingCycle,
      name: body.name,
      ownerEmail: ownerEmail || `${body.name.toLowerCase().replace(/\s+/g, '')}@pending.nexolia.local`,
      planId: body.planId ?? null,
      timezone: body.timezone,
      verticalSlug: body.verticalSlug,
    });
  }

  @Get('organizations/:id')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Organization detail' })
  async getOrg(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
  ) {
    return this.orgsService.getOrganization(authorizationHeader, organizationId);
  }

  @Get('organizations/:id/llm-credentials')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'OpenAI credential status for an organization (no raw key)',
  })
  async getLlmCredentials(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
  ) {
    await this.leadsService.requireStaff(authorizationHeader);
    return this.llmCredentialsService.getStatus(organizationId);
  }

  @Post('organizations/:id/llm-credentials/provision')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'Provision a dedicated OpenAI project + API key for Pro/Enterprise',
  })
  async provisionLlmCredentials(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
  ) {
    const staff = await this.leadsService.requireStaff(authorizationHeader);
    this.leadsService.assertSuperAdmin(staff);
    return this.llmCredentialsService.provision({
      actorUserId: staff.userId,
      organizationId,
    });
  }

  @Post('organizations/:id/llm-credentials/revoke')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Revoke the dedicated OpenAI key for an organization' })
  async revokeLlmCredentials(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
  ) {
    const staff = await this.leadsService.requireStaff(authorizationHeader);
    this.leadsService.assertSuperAdmin(staff);
    return this.llmCredentialsService.revoke({
      actorUserId: staff.userId,
      organizationId,
    });
  }

  @Patch('organizations/:id/license')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Update organization license fields' })
  async updateLicense(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
    @Body()
    body: {
      billingCycle?: 'monthly' | 'annual';
      expiresAt?: string | null;
      licensedUntil?: string | null;
      licenseStatus?: string;
      plan?: string;
      planId?: string | null;
      status?: string;
    },
  ) {
    return this.orgsService.updateLicense({
      authorizationHeader,
      billingCycle: body.billingCycle,
      licensedUntil: body.licensedUntil ?? body.expiresAt,
      licenseStatus: body.licenseStatus ?? body.status,
      organizationId,
      planId: body.planId,
    });
  }

  @Public()
  @Post('jobs/expire-trials')
  @HttpCode(200)
  @ApiSecurity('BaasJobSecret')
  @ApiOperation({
    summary: 'Move ended trial orgs to pending_payment',
  })
  @ApiHeader({
    description: 'Shared scheduler secret configured as BAAS_TASKS_JOB_SECRET.',
    name: 'x-baas-job-secret',
    required: true,
  })
  async expireTrialsJob(
    @Headers('x-baas-job-secret') jobSecret: string | undefined,
  ) {
    assertJobSecret({
      expectedSecret: process.env.BAAS_TASKS_JOB_SECRET,
      invalidMessage: 'Invalid expire-trials job secret',
      missingMessage: 'Expire-trials job secret is not configured',
      providedSecret: jobSecret,
    });
    return this.orgsService.expireEndedTrials();
  }

  @Post('organizations/:id/confirm-payment')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'Confirm payment for an org and set license_status to active',
  })
  async confirmOrganizationPayment(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
    @Body()
    body: {
      amount?: number;
      amountArs?: number;
      method?: 'cash' | 'transfer';
      notes?: string;
      reference?: string;
    },
  ) {
    return this.paymentsService.confirmOrganizationPayment({
      amountArs: body.amountArs ?? body.amount,
      authorizationHeader,
      method: body.method,
      notes: body.notes,
      organizationId,
      reference: body.reference,
    });
  }

  @Post('organizations/:id/pause')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Pause an organization license (blocks owner app + Copi)' })
  async pauseOrganization(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
  ) {
    return this.orgsService.pauseOrganization({
      authorizationHeader,
      organizationId,
    });
  }

  @Post('organizations/:id/resume')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Resume a paused organization license' })
  async resumeOrganization(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
  ) {
    return this.orgsService.resumeOrganization({
      authorizationHeader,
      organizationId,
    });
  }

  @Post('organizations/:id/archive')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Archive (soft-deactivate) an organization as staff' })
  async archiveOrganization(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
    @Body() body: { confirmation?: string },
  ) {
    return this.orgsService.archiveOrganization({
      authorizationHeader,
      confirmation: body.confirmation ?? '',
      organizationId,
    });
  }

  @Delete('organizations/:id')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'Hard-delete an organization (super-admin; confirm with org name)',
  })
  async deleteOrganization(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') organizationId: string,
    @Body() body: { confirmation?: string },
  ) {
    return this.orgsService.deleteOrganization({
      authorizationHeader,
      confirmation: body.confirmation ?? '',
      organizationId,
    });
  }

  @Get('plans')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'List SaaS plans' })
  async listPlans(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    const rows = await this.plansService.listPlans(authorizationHeader);
    return rows.map((row) => mapPlanRow(row as Record<string, unknown>));
  }

  @Patch('plans/:id')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Update a plan (prices + marketing copy)' })
  async updatePlan(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') planId: string,
    @Body()
    body: {
      copi?: string[];
      customPriceLabel?: string | null;
      featured?: boolean;
      name?: string;
      priceAnnual?: number | null;
      priceMonthly?: number | null;
      servicios?: string[];
      tagline?: string;
    },
  ) {
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) {
      patch.display_name = String(body.name).trim();
    }
    if (body.priceMonthly !== undefined) {
      patch.price_ars_monthly = normalizePlanPrice(body.priceMonthly);
    }
    if (body.priceAnnual !== undefined) {
      patch.price_ars_annual = normalizePlanPrice(body.priceAnnual);
    }

    const marketingPatch: Record<string, unknown> = {};
    if (body.tagline !== undefined) {
      marketingPatch.tagline = String(body.tagline).trim();
    }
    if (body.featured !== undefined) {
      marketingPatch.featured = Boolean(body.featured);
    }
    if (body.customPriceLabel !== undefined) {
      const label = body.customPriceLabel?.trim() || null;
      marketingPatch.customPriceLabel = label;
    }
    if (body.servicios !== undefined) {
      marketingPatch.servicios = normalizeStringList(body.servicios);
    }
    if (body.copi !== undefined) {
      marketingPatch.copi = normalizeStringList(body.copi);
    }

    if (Object.keys(marketingPatch).length > 0) {
      const rows = await this.plansService.listPlans(authorizationHeader);
      const current = rows.find((row) => row.id === planId) as
        | { marketing?: Record<string, unknown> }
        | undefined;
      patch.marketing = {
        ...(current?.marketing ?? {}),
        ...marketingPatch,
      };
    }

    const updated = await this.plansService.updatePlan({
      authorizationHeader,
      planId,
      patch,
    });
    return mapPlanRow(updated as Record<string, unknown>);
  }

  @Get('payments/pending')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'List pending license payments' })
  async pendingPayments(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    const rows = await this.paymentsService.listPending(authorizationHeader);
    return rows.map((row: Record<string, unknown>) => {
      const org = row.organizations as { id?: string; name?: string } | null;
      return {
        amount: row.amount_ars,
        createdAt: row.created_at,
        id: row.id,
        method: row.method,
        orgId: row.organization_id,
        orgName: org?.name ?? '',
        reference: row.reference,
        status: row.status === 'awaiting' ? 'pending' : row.status,
      };
    });
  }

  @Post('payments')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Create a pending license payment' })
  async createPayment(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      amount?: number;
      amountArs?: number;
      method?: 'cash' | 'transfer';
      notes?: string;
      organizationId?: string;
      orgId?: string;
      reference?: string;
    },
  ) {
    return this.paymentsService.createPayment({
      amountArs: body.amountArs ?? body.amount ?? 0,
      authorizationHeader,
      method: body.method ?? 'transfer',
      notes: body.notes,
      organizationId: body.organizationId ?? body.orgId ?? '',
      reference: body.reference,
    });
  }

  @Post('payments/:id/confirm')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Confirm cash/transfer payment and activate license' })
  async confirmPayment(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') paymentId: string,
  ) {
    return this.paymentsService.confirmPayment({
      authorizationHeader,
      paymentId,
    });
  }

  @Post('grok/chat')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Staff Grok assistant' })
  async grokChat(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      chip?: string;
      message?: string;
      messages?: Array<{ content: string; role: string }>;
    },
  ) {
    const fromMessages = body.messages?.filter((m) => m.role === 'user').at(-1)?.content;
    const message = (body.message ?? fromMessages ?? body.chip ?? '').trim();
    const result = await this.grokService.chat({
      authorizationHeader,
      message,
    });
    return {
      message: { content: result.reply, role: 'assistant' as const },
      toolResults: result.toolResults,
    };
  }
}

@Public()
@ApiTags('Public')
@Controller('public')
export class PublicLeadsController {
  constructor(
    private readonly leadsService: AdminLeadsService,
    private readonly passwordResetService: AdminPasswordResetService,
    private readonly plansService: AdminPlansService,
  ) {}

  @Get('plans')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public plan catalog for /comenzar' })
  async listPublicPlans() {
    const rows = await this.plansService.listPublicPlans();
    return rows.map((row) => mapPlanRow(row as Record<string, unknown>));
  }

  @Post('leads')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit public onboarding lead (no auth)' })
  @ApiOkResponse({ description: 'Lead created.' })
  async createLead(
    @Body()
    body: {
      billingCycle?: 'monthly' | 'annual';
      categoria?: string;
      ciclo?: 'monthly' | 'annual';
      email: string;
      featureFlags?: Record<string, boolean>;
      marketingOptIn?: boolean;
      notes?: string;
      orgName?: string;
      plan?: string;
      planSlug?: string;
      selectedServices?: string[];
      servicios?: string[];
      source?: string;
      verticalSlug?: string;
    },
  ) {
    const verticalSlug =
      body.verticalSlug ??
      (body.categoria ? CATEGORIA_TO_SLUG[body.categoria] ?? slugify(body.categoria) : undefined);
    const noteParts = [
      body.notes?.trim() || null,
      body.source && !body.notes?.includes('source=')
        ? `source=${body.source}`
        : null,
    ].filter(Boolean);
    const created = await this.leadsService.createPublicLead({
      billingCycle: body.billingCycle ?? body.ciclo ?? 'monthly',
      email: body.email,
      featureFlags: body.featureFlags,
      marketingOptIn: body.marketingOptIn ?? false,
      notes: noteParts.length > 0 ? noteParts.join('; ') : undefined,
      orgName: body.orgName,
      planSlug: body.planSlug ?? body.plan,
      selectedServices: body.selectedServices ?? body.servicios ?? [],
      verticalSlug,
    });
    return {
      createdAt: new Date().toISOString(),
      email: body.email.trim().toLowerCase(),
      id: created.id,
      organizationId: null,
      status: 'new',
    };
  }

  @Post('org-name-check')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Check if organization name is already registered' })
  async checkOrgName(@Body() body: { email?: string; name?: string }) {
    return this.leadsService.checkOrgName({
      email: body.email,
      name: body.name ?? '',
    });
  }

  @Post('admin/password-reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request staff password reset email (Spanish, invite/staff only)',
  })
  @ApiOkResponse({ description: 'Always ok (no enumeration).' })
  async requestAdminPasswordReset(@Body() body: { email?: string }) {
    try {
      return await this.passwordResetService.requestReset(body.email ?? '');
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Ingresá un correo válido.',
      );
    }
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizePlanPrice(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0);
}

function mapPlanRow(row: Record<string, unknown>) {
  const marketing = (row.marketing ?? {}) as {
    copi?: unknown;
    customPriceLabel?: unknown;
    featured?: unknown;
    servicios?: unknown;
    tagline?: unknown;
  };
  const priceMonthly = Number(row.price_ars_monthly ?? 0);
  const priceAnnual = Number(row.price_ars_annual ?? 0);
  const customPriceLabel =
    typeof marketing.customPriceLabel === 'string' &&
    marketing.customPriceLabel.trim()
      ? marketing.customPriceLabel.trim()
      : null;
  const servicios = normalizeStringList(marketing.servicios);
  const copi = normalizeStringList(marketing.copi);
  return {
    copi,
    customPriceLabel,
    featured: Boolean(marketing.featured),
    features: [...servicios, ...copi],
    id: row.id,
    name: row.display_name,
    priceAnnual: customPriceLabel ? null : priceAnnual || null,
    priceMonthly: customPriceLabel ? null : priceMonthly || null,
    servicios,
    slug: row.slug,
    tagline:
      typeof marketing.tagline === 'string' ? marketing.tagline.trim() : '',
  };
}
