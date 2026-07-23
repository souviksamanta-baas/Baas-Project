import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  InstagramConnectionSummaryDto,
  InstagramDisconnectDto,
  InstagramMessagingWindowStateDto,
  InstagramOAuthCallbackDto,
  InstagramOAuthStartDto,
  InstagramOAuthStartResponseDto,
  InstagramSendMessageDto,
  InstagramSendMessageResponseDto,
} from '../../docs/openapi.dtos';
import type { InstagramConnectionSummary } from './instagram-connection.types';
import type { InstagramMessagingWindowState } from './instagram-connection.types';
import { InstagramConnectionService } from './instagram-connection.service';
import { InstagramMessagingService } from './instagram-messaging.service';
import { InstagramOAuthService } from './instagram-oauth.service';

@ApiTags('Instagram')
@ApiBearerAuth('SupabaseAuth')
@Controller('instagram')
export class InstagramController {
  constructor(
    private readonly connectionService: InstagramConnectionService,
    private readonly messagingService: InstagramMessagingService,
    private readonly oauthService: InstagramOAuthService,
  ) {}

  @Post('oauth/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start Instagram Business Login OAuth' })
  @ApiOkResponse({ type: InstagramOAuthStartResponseDto })
  async startOAuth(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: InstagramOAuthStartDto,
  ): Promise<{ authUrl: string; state: string }> {
    try {
      return await this.oauthService.startOAuth({
        authorizationHeader,
        organizationId: body.organizationId,
      });
    } catch (error) {
      if (error instanceof Error && /token|owner|auth/i.test(error.message)) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Post('oauth/callback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete Instagram Business Login OAuth' })
  @ApiOkResponse({ type: InstagramConnectionSummaryDto })
  async oauthCallback(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: InstagramOAuthCallbackDto,
  ): Promise<InstagramConnectionSummary> {
    return this.oauthService.handleCallback({
      authorizationHeader,
      code: body.code,
      state: body.state,
    });
  }

  @Post('connection/disconnect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disconnect Instagram Messaging for the organization' })
  async disconnect(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: InstagramDisconnectDto,
  ): Promise<{ disconnected: true }> {
    return this.oauthService.disconnect({
      authorizationHeader,
      organizationId: body.organizationId,
    });
  }

  @Post('connection/register')
  @HttpCode(200)
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated: manual token register (prefer oauth/start)',
  })
  @ApiOkResponse({ type: InstagramConnectionSummaryDto })
  async registerConnection(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      accessToken: string;
      igUserId: string;
      igUsername?: string;
      organizationId: string;
      pageId?: string;
    },
  ): Promise<InstagramConnectionSummary> {
    try {
      return await this.connectionService.registerConnection({
        accessToken: body.accessToken,
        authorizationHeader,
        igUserId: body.igUserId,
        igUsername: body.igUsername,
        organizationId: body.organizationId,
        pageId: body.pageId,
      });
    } catch (error) {
      if (error instanceof Error && /token|owner/i.test(error.message)) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Get('messages/window-state')
  @ApiOperation({ summary: 'Get Instagram messaging window state for a conversation' })
  @ApiOkResponse({ type: InstagramMessagingWindowStateDto })
  async windowState(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('conversationId') conversationId: string,
    @Query('organizationId') organizationId: string,
  ): Promise<{
    expiresAt: string | null;
    lastInboundAt: string | null;
    state: InstagramMessagingWindowState;
  }> {
    return this.messagingService.getMessagingState({
      authorizationHeader,
      conversationId,
      organizationId,
    });
  }

  @Post('messages/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send an Instagram text reply' })
  @ApiOkResponse({ type: InstagramSendMessageResponseDto })
  async sendMessage(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: InstagramSendMessageDto,
  ): Promise<{ externalMessageId: string | null; status: 'sent' }> {
    return this.messagingService.sendText({
      authorizationHeader,
      body: body.body,
      businessCenterId: body.businessCenterId,
      conversationId: body.conversationId,
      organizationId: body.organizationId,
    });
  }
}
