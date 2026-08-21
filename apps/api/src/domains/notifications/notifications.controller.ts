import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { AuthSessionService } from '../auth/auth-session.service';
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
    private readonly authSessionService: AuthSessionService,
  ) {}

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
    const userId = await this.authSessionService.getUserIdFromBearerToken(authorizationHeader);
    return this.notificationsService.getPrefs({ organizationId, userId });
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
    const userId = await this.authSessionService.getUserIdFromBearerToken(authorizationHeader);
    return this.notificationsService.upsertPrefs({
      enabled: body.enabled,
      organizationId: body.organizationId,
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
    const userId = await this.authSessionService.getUserIdFromBearerToken(authorizationHeader);
    if (!CLIENT_EVENT_TYPES.includes(body.type)) {
      throw new UnauthorizedException('Unsupported notification event type');
    }

    return this.notificationsService.notifyClientEvent({
      body: body.body,
      businessCenterId: body.businessCenterId,
      creatorUserId: userId,
      organizationId: body.organizationId,
      payload: body.payload,
      sourceKey: body.sourceKey,
      title: body.title,
      type: body.type,
    });
  }

  @Post('run-scheduled')
  @ApiSecurity('BaasJobSecret')
  @ApiOperation({ summary: 'Run scheduled digests and reminder notifications' })
  async runScheduled(
    @Headers('x-baas-job-secret') jobSecret: string | undefined,
  ): Promise<{ notificationsCreated: number; pushFailed: number; pushSent: number }> {
    const expectedSecret = process.env.BAAS_TASKS_JOB_SECRET;
    if (!expectedSecret) {
      throw new ServiceUnavailableException('Notification job secret is not configured');
    }
    if (jobSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid notification job secret');
    }

    return this.notificationsService.runScheduled();
  }
}
