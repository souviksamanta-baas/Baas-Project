import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

import { Public, SkipOrgMembership } from '../../auth/auth.decorators';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import {
  BrowserSessionService,
  type BrowserSessionCreateResult,
  type BrowserSessionPollResult,
} from './browser-session.service';
import { DesktopWorkspaceService } from './desktop-workspace.service';

class PollBrowserSessionDto {
  @IsUUID()
  challengeId!: string;

  @IsString()
  @MinLength(20)
  pollSecret!: string;
}

class ApproveBrowserSessionDto {
  @IsUUID()
  challengeId!: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

class RefreshBrowserSessionDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

@ApiTags('Auth')
@Controller('auth/browser-sessions')
export class BrowserSessionController {
  constructor(
    private readonly browserSessions: BrowserSessionService,
    private readonly workspace: DesktopWorkspaceService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(): Promise<BrowserSessionCreateResult> {
    return this.browserSessions.create();
  }

  @Public()
  @Post('poll')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  poll(@Body() body: PollBrowserSessionDto): Promise<BrowserSessionPollResult> {
    return this.browserSessions.poll(body.challengeId, body.pollSecret);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() body: RefreshBrowserSessionDto) {
    return this.browserSessions.refresh(body.refreshToken);
  }

  @SkipOrgMembership()
  @ApiBearerAuth('SupabaseAuth')
  @Post('approve')
  @HttpCode(200)
  approve(@Req() request: AuthenticatedRequest, @Body() body: ApproveBrowserSessionDto) {
    const userId = request.user?.id;
    const accessToken = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!userId || !accessToken) {
      throw new UnauthorizedException('Iniciá sesión en el celular para confirmar.');
    }
    return this.browserSessions.approve(
      body.challengeId,
      userId,
      accessToken,
      body.organizationId ?? null,
    );
  }

  @SkipOrgMembership()
  @ApiBearerAuth('SupabaseAuth')
  @Get('workspace')
  workspaceFor(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.workspace.load(authorizationHeader, organizationId);
  }
}
