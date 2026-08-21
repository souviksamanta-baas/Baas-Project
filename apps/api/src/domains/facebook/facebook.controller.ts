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
  FacebookConnectionSummaryDto,
  FacebookDisconnectDto,
  FacebookMessagingWindowStateDto,
  FacebookOAuthCallbackDto,
  FacebookOAuthStartDto,
  FacebookOAuthStartResponseDto,
  FacebookSendMessageDto,
  FacebookSendMessageResponseDto,
} from '../../docs/openapi.dtos';
import type {
  FacebookConnectionSummary,
  FacebookMessagingWindowState,
} from './facebook-connection.types';
import { FacebookConnectionService } from './facebook-connection.service';
import { FacebookMessagingService } from './facebook-messaging.service';
import { FacebookOAuthService } from './facebook-oauth.service';

@ApiTags('Facebook')
@ApiBearerAuth('SupabaseAuth')
@Controller('facebook')
export class FacebookController {
  constructor(
    private readonly connectionService: FacebookConnectionService,
    private readonly messagingService: FacebookMessagingService,
    private readonly oauthService: FacebookOAuthService,
  ) {}

  @Post('oauth/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start Facebook Login for pages OAuth' })
  @ApiOkResponse({ type: FacebookOAuthStartResponseDto })
  async startOAuth(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: FacebookOAuthStartDto,
  ): Promise<{ authUrl: string; redirectUri: string; state: string }> {
    return this.oauthService.startOAuth({
      authorizationHeader,
      organizationId: body.organizationId,
    });
  }

  @Post('oauth/callback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete Facebook Login for pages OAuth' })
  @ApiOkResponse({ type: FacebookConnectionSummaryDto })
  async oauthCallback(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: FacebookOAuthCallbackDto,
  ): Promise<FacebookConnectionSummary> {
    return this.oauthService.handleCallback({
      authorizationHeader,
      code: body.code,
      pageId: body.pageId,
      state: body.state,
    });
  }

  @Post('connection/disconnect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disconnect Facebook Messenger for the organization' })
  async disconnect(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: FacebookDisconnectDto,
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
  @ApiOkResponse({ type: FacebookConnectionSummaryDto })
  async registerConnection(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      accessToken: string;
      organizationId: string;
      pageId: string;
      pageName?: string;
    },
  ): Promise<FacebookConnectionSummary> {
    try {
      return await this.connectionService.registerConnection({
        accessToken: body.accessToken,
        authorizationHeader,
        organizationId: body.organizationId,
        pageId: body.pageId,
        pageName: body.pageName,
      });
    } catch (error) {
      if (error instanceof Error && /token|owner/i.test(error.message)) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Get('messages/window-state')
  @ApiOperation({ summary: 'Get Facebook messaging window state for a conversation' })
  @ApiOkResponse({ type: FacebookMessagingWindowStateDto })
  async windowState(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('conversationId') conversationId: string,
    @Query('organizationId') organizationId: string,
  ): Promise<{
    expiresAt: string | null;
    lastInboundAt: string | null;
    state: FacebookMessagingWindowState;
  }> {
    return this.messagingService.getMessagingState({
      authorizationHeader,
      conversationId,
      organizationId,
    });
  }

  @Post('messages/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a Facebook Messenger text reply' })
  @ApiOkResponse({ type: FacebookSendMessageResponseDto })
  async sendMessage(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: FacebookSendMessageDto,
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
