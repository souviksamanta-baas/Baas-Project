import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthResponseDto } from './docs/openapi.dtos';

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
