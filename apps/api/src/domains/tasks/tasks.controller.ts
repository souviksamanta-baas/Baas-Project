import {
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ErrorResponseDto, TaskMaintenanceResultDto } from '../../docs/openapi.dtos';
import { type TaskMaintenanceResult, TasksService } from './tasks.service';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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
}
