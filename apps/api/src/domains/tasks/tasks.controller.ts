import {
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { type TaskMaintenanceResult, TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('run-maintenance')
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
