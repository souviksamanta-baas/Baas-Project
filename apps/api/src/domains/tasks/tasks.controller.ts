import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  assertOrgMembership,
  isOwnerOrCoOwner,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { ErrorResponseDto, TaskMaintenanceResultDto } from '../../docs/openapi.dtos';
import { SupabaseService } from '../../supabase/supabase.service';
import { AppointmentsService } from '../appointments/appointments.service';
import {
  type OwnerTaskRecord,
  type OwnerTaskStatus,
  type TaskMaintenanceResult,
  TasksService,
} from './tasks.service';

interface CreateTaskBody {
  assignedToUserId: string;
  businessCenterId: string;
  contactId?: string | null;
  conversationId?: string | null;
  description: string;
  dueAt: string;
  metadata?: Record<string, unknown>;
  organizationId: string;
  priority?: 'low' | 'normal' | 'high';
  title: string;
}

interface UpdateTaskBody {
  businessCenterId: string;
  contactId?: string | null;
  description?: string | null;
  dueAt?: string | null;
  organizationId: string;
  priority?: 'low' | 'normal' | 'high';
  title?: string;
}

interface AssignTaskBody {
  assignedToUserId: string;
  businessCenterId: string;
  organizationId: string;
}

interface PostponeTaskBody {
  businessCenterId: string;
  organizationId: string;
  postponedUntil: string;
}

interface StatusMutationBody {
  businessCenterId: string;
  organizationId: string;
}

interface SnoozeReminderBody {
  businessCenterId: string;
  minutes?: number;
  organizationId: string;
}

interface FollowerBody {
  businessCenterId: string;
  organizationId: string;
}

interface CreateAppointmentFromTaskBody {
  businessCenterId: string;
  endsAt?: string;
  notes?: string | null;
  organizationId: string;
  startsAt: string;
  title?: string;
}

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly appointmentsService: AppointmentsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post('run-maintenance')
  @ApiSecurity('BaasJobSecret')
  @ApiOperation({
    summary: 'Run follow-up and alert maintenance',
    description:
      'Secured scheduler endpoint that creates idle-lead follow-up tasks, low-stock alerts, and push notifications.',
  })
  @ApiHeader({
    description: 'Shared scheduler secret configured as BAAS_TASKS_JOB_SECRET.',
    name: 'x-baas-job-secret',
    required: true,
  })
  @ApiOkResponse({
    description: 'Maintenance completed and aggregate counts are returned.',
    type: TaskMaintenanceResultDto,
  })
  @ApiUnauthorizedResponse({ description: 'The scheduler secret is missing or invalid.', type: ErrorResponseDto })
  @ApiResponse({
    description: 'The API is not configured with BAAS_TASKS_JOB_SECRET.',
    status: 503,
    type: ErrorResponseDto,
  })
  async runMaintenance(
    @Headers('x-baas-job-secret') jobSecret: string | undefined,
  ): Promise<TaskMaintenanceResult> {
    const expectedSecret = process.env.BAAS_TASKS_JOB_SECRET;

    if (!expectedSecret) {
      throw new ServiceUnavailableException('Task maintenance job secret is not configured');
    }

    if (jobSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid task maintenance job secret');
    }

    return this.tasksService.runMaintenance();
  }

  @Get()
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'List tasks for the current organization (org-wide visibility)' })
  async listTasks(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('organizationId') organizationId: string,
    @Query('businessCenterId') businessCenterId: string | undefined,
    @Query('statuses') statuses: string | undefined,
    @Query('assignedToUserId') assignedToUserId: string | undefined,
    @Query('dueFrom') dueFrom: string | undefined,
    @Query('dueBefore') dueBefore: string | undefined,
    @Query('contactHint') contactHint: string | undefined,
    @Query('limit') limit: string | undefined,
  ): Promise<OwnerTaskRecord[]> {
    await this.requireMembership({
      authorizationHeader,
      organizationId,
    });
    this.assertRequired({ organizationId });

    return this.tasksService.listTasks({
      assignedToUserId: assignedToUserId?.trim() || undefined,
      businessCenterId,
      contactHint: contactHint?.trim() || undefined,
      dueBefore: dueBefore?.trim() || undefined,
      dueFrom: dueFrom?.trim() || undefined,
      limit: parseOptionalInt(limit),
      organizationId,
      statuses: parseStatusesQuery(statuses),
    });
  }

  @Get(':taskId')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Get a single task' })
  async getTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Query('organizationId') organizationId: string,
    @Query('businessCenterId') businessCenterId: string | undefined,
  ): Promise<OwnerTaskRecord> {
    await this.requireMembership({ authorizationHeader, organizationId });
    this.assertRequired({ organizationId });
    return this.tasksService.getTask({ businessCenterId, organizationId, taskId });
  }

  @Post()
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'Create a task (title, description, dueAt, assignedToUserId are mandatory)',
  })
  async createTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CreateTaskBody,
  ): Promise<OwnerTaskRecord> {
    const user = await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    this.assertRequired({
      assignedToUserId: body.assignedToUserId,
      businessCenterId: body.businessCenterId,
      description: body.description,
      dueAt: body.dueAt,
      organizationId: body.organizationId,
      title: body.title,
    });

    return this.tasksService.createTask({
      assignedToUserId: body.assignedToUserId,
      businessCenterId: body.businessCenterId,
      contactId: body.contactId ?? null,
      conversationId: body.conversationId ?? null,
      createdByUserId: user.userId,
      description: body.description,
      dueAt: body.dueAt,
      metadata: body.metadata ?? {},
      organizationId: body.organizationId,
      priority: body.priority ?? 'normal',
      sourceKey: `rest:${user.userId}:${Date.now()}`,
      taskType: 'manual',
      title: body.title,
    });
  }

  @Patch(':taskId')
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Update task title/description/dueAt/priority/contact' })
  async updateTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskBody,
  ): Promise<OwnerTaskRecord> {
    await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    this.assertRequired({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
    });

    return this.tasksService.updateTask({
      businessCenterId: body.businessCenterId,
      contactId: body.contactId,
      description: body.description,
      dueAt: body.dueAt,
      organizationId: body.organizationId,
      priority: body.priority,
      taskId,
      title: body.title,
    });
  }

  @Post(':taskId/assign')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'Assign or reassign a task (assignee, owner, or co-owner)',
  })
  async assignTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: AssignTaskBody,
  ): Promise<OwnerTaskRecord> {
    const membership = await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    const task = await this.tasksService.getTask({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      taskId,
    });
    const isAssignee = task.assignedToUserId === membership.userId;
    if (!isOwnerOrCoOwner(membership.role) && !isAssignee) {
      throw new ForbiddenException(
        'Solo el asignado, el dueño o un co-dueño pueden reasignar tareas.',
      );
    }
    this.assertRequired({
      assignedToUserId: body.assignedToUserId,
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
    });

    return this.tasksService.assignTask({
      assignedToUserId: body.assignedToUserId,
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      taskId,
    });
  }

  @Post(':taskId/start')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Mark task as in_progress' })
  async startTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: StatusMutationBody,
  ): Promise<OwnerTaskRecord> {
    const membership = await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    this.assertRequired({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
    });

    return this.tasksService.startTask({
      actorUserId: membership.userId,
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      taskId,
    });
  }

  @Post(':taskId/complete')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Mark task as completed' })
  async completeTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: StatusMutationBody,
  ): Promise<OwnerTaskRecord> {
    const membership = await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    this.assertRequired({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
    });

    return this.tasksService.updateTaskStatus({
      actorUserId: membership.userId,
      businessCenterId: body.businessCenterId,
      completedByUserId: membership.userId,
      organizationId: body.organizationId,
      status: 'completed',
      taskId,
    });
  }

  @Post(':taskId/cancel')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'Mark task as cancelled (assignee, owner, or co-owner)',
  })
  async cancelTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: StatusMutationBody,
  ): Promise<OwnerTaskRecord> {
    const membership = await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    const task = await this.tasksService.getTask({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      taskId,
    });
    const isAssignee = task.assignedToUserId === membership.userId;
    if (!isOwnerOrCoOwner(membership.role) && !isAssignee) {
      throw new ForbiddenException(
        'Solo el asignado, el dueño o un co-dueño pueden cancelar tareas.',
      );
    }
    this.assertRequired({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
    });

    return this.tasksService.updateTaskStatus({
      actorUserId: membership.userId,
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      status: 'cancelled',
      taskId,
    });
  }

  @Post(':taskId/postpone')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Postpone task until a future datetime' })
  async postponeTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: PostponeTaskBody,
  ): Promise<OwnerTaskRecord> {
    const membership = await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    this.assertRequired({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      postponedUntil: body.postponedUntil,
    });

    return this.tasksService.postponeTask({
      actorUserId: membership.userId,
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      postponedUntil: body.postponedUntil,
      taskId,
    });
  }

  @Post(':taskId/snooze-reminder')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Silence task reminder for a short window (default 10 min)' })
  async snoozeReminder(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: SnoozeReminderBody,
  ): Promise<OwnerTaskRecord> {
    await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    this.assertRequired({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
    });

    return this.tasksService.snoozeReminder({
      businessCenterId: body.businessCenterId,
      minutes: body.minutes,
      organizationId: body.organizationId,
      taskId,
    });
  }

  @Post(':taskId/followers')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Follow a task to receive its notifications' })
  async followTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: FollowerBody,
  ): Promise<{ added: boolean }> {
    const membership = await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    return this.tasksService.addFollower({
      organizationId: body.organizationId,
      taskId,
      userId: membership.userId,
    });
  }

  @Delete(':taskId/followers')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Unfollow a task' })
  async unfollowTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Query('organizationId') organizationId: string,
  ): Promise<{ removed: boolean }> {
    const membership = await this.requireMembership({
      authorizationHeader,
      organizationId,
    });
    return this.tasksService.removeFollower({
      organizationId,
      taskId,
      userId: membership.userId,
    });
  }

  @Post(':taskId/appointments')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Create an appointment linked to this task' })
  async createAppointmentFromTask(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('taskId') taskId: string,
    @Body() body: CreateAppointmentFromTaskBody,
  ): Promise<{ appointmentId: string; startsAt: string; endsAt: string; title: string }> {
    const membership = await this.requireMembership({
      authorizationHeader,
      organizationId: body.organizationId,
    });
    this.assertRequired({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      startsAt: body.startsAt,
    });

    const task = await this.tasksService.getTask({
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      taskId,
    });

    const startsAt = body.startsAt;
    const endsAt =
      body.endsAt && body.endsAt.trim().length > 0
        ? body.endsAt
        : new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString();

    const appointment = await this.appointmentsService.createFromTask({
      assignedToUserId: task.assignedToUserId,
      businessCenterId: body.businessCenterId,
      contactId: task.contactId,
      createdByUserId: membership.userId,
      endsAt,
      notes: body.notes ?? null,
      organizationId: body.organizationId,
      startsAt,
      task,
      title: body.title ?? task.title,
    });

    return {
      appointmentId: appointment.id,
      endsAt: appointment.endsAt,
      startsAt: appointment.startsAt,
      title: appointment.title,
    };
  }

  private async requireMembership(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<{ role: 'owner' | 'co_owner' | 'manager' | 'staff'; userId: string }> {
    if (!params.organizationId?.trim()) {
      throw new BadRequestException('organizationId es obligatorio.');
    }

    const user = await resolveAuthUser(this.supabaseService, params.authorizationHeader);
    const role = await assertOrgMembership({
      organizationId: params.organizationId,
      supabaseService: this.supabaseService,
      userId: user.id,
    });
    return { role, userId: user.id };
  }

  private assertRequired(fields: Record<string, unknown>): void {
    const missing: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) {
        missing.push(key);
        continue;
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(`Faltan campos obligatorios: ${missing.join(', ')}`);
    }
  }
}

function parseStatusesQuery(value: string | undefined): OwnerTaskStatus[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const allowed: OwnerTaskStatus[] = [
    'pending',
    'in_progress',
    'completed',
    'cancelled',
    'postponed',
  ];
  const parts = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is OwnerTaskStatus => (allowed as string[]).includes(item));
  return parts.length > 0 ? parts : undefined;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
