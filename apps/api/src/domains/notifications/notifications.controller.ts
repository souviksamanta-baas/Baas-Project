import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/auth.decorators';
import { assertJobSecret } from '../../auth/job-secret.util';
import { requireOrganizationId } from '../../auth/org-membership.guard';
import {
  assertOrgMembership,
  resolveUserId,
} from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  NOTIFICATION_CATALOG,
  normalizeReminderLeadMinutes,
  type NotificationTypeId,
  type ReminderLeadMinutes,
} from './notification.catalog';
import { NotificationsService } from './notifications.service';

const CLIENT_EVENT_TYPES: NotificationTypeId[] = [
  'sales.completed',
  'payment.received',
  'payment.failed',
  'stock.movement',
  'quote.accepted',
];

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Public()
  @Get('catalog')
  @ApiOperation({ summary: 'List notification catalog entries and defaults' })
  @ApiOkResponse({ description: 'Catalog of notification types' })
  getCatalog(): typeof NOTIFICATION_CATALOG {
    return NOTIFICATION_CATALOG;
  }

  @Get('prefs')
  @ApiOperation({ summary: 'Get notification preferences for the current user' })
  async getPrefs(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('organizationId') organizationId: string,
  ): Promise<{ enabled: Record<string, boolean>; reminderLeadMinutes: ReminderLeadMinutes }> {
    const orgId = requireOrganizationId(organizationId);
    const userId = await resolveUserId(this.supabaseService, authorizationHeader);
    await assertOrgMembership({
      organizationId: orgId,
      supabaseService: this.supabaseService,
      userId,
    });
    return this.notificationsService.getPrefs({ organizationId: orgId, userId });
  }

  @Put('prefs')
  @ApiOperation({ summary: 'Update notification preferences (reminder lead time + enables)' })
  async putPrefs(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      enabled?: Record<string, boolean>;
      organizationId: string;
      reminderLeadMinutes?: number;
    },
  ): Promise<{ enabled: Record<string, boolean>; reminderLeadMinutes: ReminderLeadMinutes }> {
    const orgId = requireOrganizationId(body.organizationId);
    const userId = await resolveUserId(this.supabaseService, authorizationHeader);
    await assertOrgMembership({
      organizationId: orgId,
      supabaseService: this.supabaseService,
      userId,
    });
    return this.notificationsService.upsertPrefs({
      enabled: body.enabled,
      organizationId: orgId,
      reminderLeadMinutes: normalizeReminderLeadMinutes(body.reminderLeadMinutes),
      userId,
    });
  }

  @Post('events')
  @ApiOperation({ summary: 'Emit a client-originated commerce/ops notification event' })
  async emitEvent(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      body: string;
      businessCenterId: string;
      organizationId: string;
      payload?: Record<string, unknown>;
      sourceKey: string;
      title?: string;
      type: NotificationTypeId;
    },
  ): Promise<{ created: boolean; sent: number }> {
    const orgId = requireOrganizationId(body.organizationId);
    const userId = await resolveUserId(this.supabaseService, authorizationHeader);
    await assertOrgMembership({
      organizationId: orgId,
      supabaseService: this.supabaseService,
      userId,
    });
    if (!CLIENT_EVENT_TYPES.includes(body.type)) {
      throw new UnauthorizedException('Unsupported notification event type');
    }
    if (!body.body?.trim() || !body.businessCenterId?.trim() || !body.sourceKey?.trim()) {
      throw new BadRequestException('body, businessCenterId, and sourceKey are required');
    }

    return this.notificationsService.notifyClientEvent({
      body: body.body,
      businessCenterId: body.businessCenterId,
      creatorUserId: userId,
      organizationId: orgId,
      payload: body.payload,
      sourceKey: body.sourceKey,
      title: body.title,
      type: body.type,
    });
  }

  @Public()
  @Post('run-scheduled')
  @ApiSecurity('BaasJobSecret')
  @ApiOperation({ summary: 'Run scheduled digests and reminder notifications' })
  async runScheduled(
    @Headers('x-baas-job-secret') jobSecret: string | undefined,
  ): Promise<{ notificationsCreated: number; pushFailed: number; pushSent: number }> {
    assertJobSecret({
      expectedSecret: process.env.BAAS_TASKS_JOB_SECRET,
      invalidMessage: 'Invalid notification job secret',
      missingMessage: 'Notification job secret is not configured',
      providedSecret: jobSecret,
    });

    return this.notificationsService.runScheduled();
  }

  @Post('startup-sample')
  @ApiOperation({ summary: 'Record one app-open responsiveness sample' })
  async recordStartupSample(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      appVersion?: string | null;
      deviceModel?: string | null;
      maxStallMs?: number;
      organizationId?: string;
      osVersion?: string | null;
      platform?: string;
      timeToFirstTapMs?: number | null;
    },
  ): Promise<{ ok: true }> {
    const organizationId = requireOrganizationId(body.organizationId);
    const userId = await resolveUserId(this.supabaseService, authorizationHeader);
    await assertOrgMembership({
      organizationId,
      supabaseService: this.supabaseService,
      userId,
    });

    const maxStallMs = clampSampleMs(body.maxStallMs);
    if (maxStallMs == null) {
      throw new BadRequestException('maxStallMs is required');
    }

    const platform = (body.platform ?? '').trim().slice(0, 20);
    if (!platform) {
      throw new BadRequestException('platform is required');
    }

    const timeToFirstTapMs =
      body.timeToFirstTapMs == null ? null : clampSampleMs(body.timeToFirstTapMs);

    const { error } = await this.supabaseService.getServiceRoleClient().from('app_startup_samples').insert({
      app_version: clipText(body.appVersion, 40),
      device_model: clipText(body.deviceModel, 80),
      max_stall_ms: maxStallMs,
      organization_id: organizationId,
      os_version: clipText(body.osVersion, 40),
      platform,
      time_to_first_tap_ms: timeToFirstTapMs,
      user_id: userId,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ok: true };
  }
}

function clipText(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clampSampleMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(60_000, Math.round(value)));
}
