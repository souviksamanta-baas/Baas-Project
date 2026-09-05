import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGrokService } from './admin-grok.service';
import { AdminLeadsService } from './admin-leads.service';
import { AdminPasswordResetService } from './admin-password-reset.service';
import {
  AdminDashboardService,
  AdminOrgsService,
  AdminPaymentsService,
  AdminPlansService,
} from './admin-orgs.service';

const CATEGORIA_TO_SLUG: Record<string, string> = {
  Ferretería: 'ferreteria',
  Dietética: 'dietetica',
  Clínica: 'clinica',
  Veterinaria: 'veterinaria',
  Restaurante: 'restaurante',
  Taller: 'taller',
  'Servicios profesionales': 'servicios_profesionales',
};

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
    const kpis = await this.dashboardService.getKpis(authorizationHeader);
    return {
      activity: [],
      kpis: [
        {
          label: 'Clientes activos',
          tone: 'positive',
          value: kpis.activeLicenses,
        },
        {
          label: 'En prueba',
          tone: 'positive',
          value: kpis.trialLicenses,
        },
        {
          label: 'Pagos por confirmar',
          tone: 'warning',
          value: kpis.pendingPayments,
        },
        {
          label: 'Licencias por vencer',
          tone: 'warning',
          value: kpis.expiringSoon,
        },
      ],
      paymentsByDay: [],
      recentClients: [],
      raw: kpis,
    };
  }

  @Get('leads')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'List leads' })
  async listLeads(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    const rows = await this.leadsService.listLeads(authorizationHeader);
    return rows.map((row: Record<string, unknown>) => ({
      business: String(row.email ?? '').split('@')[0],
      categoria: row.vertical_slug ?? '',
      ciclo: row.billing_cycle ?? 'monthly',
      createdAt: row.created_at,
      email: row.email,
      id: row.id,
      plan: row.plan_slug ?? '',
      servicios: Array.isArray(row.selected_services) ? row.selected_services : [],
      status: row.status,
    }));
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

  @Get('organizations')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'List organizations for staff' })
  async listOrgs(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    const rows = await this.orgsService.listOrganizations(authorizationHeader);
    return rows.map((row: Record<string, unknown>) => {
      const plans = row.plans as { display_name?: string; slug?: string } | null;
      const owners = row.registered_owners as Array<{ email?: string }> | null;
      return {
        id: row.id,
        licenseExpiresAt: row.licensed_until,
        members: 0,
        name: row.name,
        ownerEmail: owners?.[0]?.email,
        plan: plans?.display_name ?? plans?.slug ?? '',
        status: row.license_status,
      };
    });
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

  @Get('plans')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'List SaaS plans' })
  async listPlans(
    @Headers('authorization') authorizationHeader: string | undefined,
  ) {
    const rows = await this.plansService.listPlans(authorizationHeader);
    return rows.map((row: Record<string, unknown>) => ({
      featured: row.slug === 'basico',
      features: Object.keys((row.feature_flags as Record<string, boolean>) ?? {}).filter(
        (k) => (row.feature_flags as Record<string, boolean>)[k],
      ),
      id: row.id,
      name: row.display_name,
      priceAnnual: row.price_ars_annual,
      priceMonthly: row.price_ars_monthly,
      slug: row.slug,
    }));
  }

  @Patch('plans/:id')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Update a plan' })
  async updatePlan(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id') planId: string,
    @Body()
    body: Record<string, unknown> & {
      name?: string;
      priceAnnual?: number;
      priceMonthly?: number;
    },
  ) {
    const patch: Record<string, unknown> = { ...body };
    if (body.name !== undefined) {
      patch.display_name = body.name;
      delete patch.name;
    }
    if (body.priceMonthly !== undefined) {
      patch.price_ars_monthly = body.priceMonthly;
      delete patch.priceMonthly;
    }
    if (body.priceAnnual !== undefined) {
      patch.price_ars_annual = body.priceAnnual;
      delete patch.priceAnnual;
    }
    return this.plansService.updatePlan({
      authorizationHeader,
      planId,
      patch,
    });
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

@ApiTags('Public')
@Controller('public')
export class PublicLeadsController {
  constructor(
    private readonly leadsService: AdminLeadsService,
    private readonly passwordResetService: AdminPasswordResetService,
  ) {}

  @Post('leads')
  @HttpCode(200)
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
    const created = await this.leadsService.createPublicLead({
      billingCycle: body.billingCycle ?? body.ciclo ?? 'monthly',
      email: body.email,
      featureFlags: body.featureFlags,
      marketingOptIn: body.marketingOptIn ?? false,
      notes: body.notes ?? (body.source ? `source=${body.source}` : undefined),
      orgName: body.orgName,
      planSlug: body.planSlug ?? body.plan,
      selectedServices: body.selectedServices ?? body.servicios ?? [],
      verticalSlug,
    });
    return {
      createdAt: new Date().toISOString(),
      email: body.email.trim().toLowerCase(),
      id: created.id,
      status: 'new',
    };
  }

  @Post('org-name-check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check if organization name is already registered' })
  async checkOrgName(@Body() body: { email?: string; name?: string }) {
    return this.leadsService.checkOrgName({
      email: body.email,
      name: body.name ?? '',
    });
  }

  @Post('admin/password-reset')
  @HttpCode(200)
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
