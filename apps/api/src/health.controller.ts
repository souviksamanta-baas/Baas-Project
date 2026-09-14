import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from './auth/auth.decorators';

import { HealthResponseDto } from './docs/openapi.dtos';

@Public()
@SkipThrottle()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API health' })
  @ApiOkResponse({ description: 'The API is running.', type: HealthResponseDto })
  health(): HealthResponseDto {
    return { status: 'ok' };
  }
}
