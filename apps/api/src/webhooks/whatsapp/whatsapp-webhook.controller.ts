import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { getWebhookRateLimitMax, getWebhookRateLimitTtl } from '../../config/api-config';
import {
  ErrorResponseDto,
  WhatsAppWebhookPayloadDto,
  WhatsAppWebhookResponseDto,
} from '../../docs/openapi.dtos';
import {
  InvalidWebhookSignatureError,
  WhatsAppWebhookService,
} from './whatsapp-webhook.service';
import {
  WhatsAppWebhookPayload,
  WhatsAppWebhookResponse,
} from './whatsapp-webhook.types';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Throttle({
  default: {
    limit: getWebhookRateLimitMax,
    ttl: getWebhookRateLimitTtl,
  },
})
@ApiTags('WhatsApp Webhooks')
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly webhookService: WhatsAppWebhookService) {}

  @Get()
  @ApiOperation({
    summary: 'Verify WhatsApp webhook subscription',
    description: 'Responds to Meta webhook verification challenges when the configured verify token matches.',
  })
  @ApiQuery({ name: 'hub.mode', required: false, example: 'subscribe' })
  @ApiQuery({ name: 'hub.verify_token', required: false, example: 'configured-meta-verify-token' })
  @ApiQuery({ name: 'hub.challenge', required: false, example: '1158201444' })
  @ApiOkResponse({
    description: 'The raw Meta challenge string. Meta expects text/plain content.',
    schema: { example: '1158201444', type: 'string' },
  })
  @ApiForbiddenResponse({
    description: 'The verification token or challenge request is invalid.',
    type: ErrorResponseDto,
  })
  @ApiResponse({ description: 'Webhook verification requests are rate limited.', status: 429, type: ErrorResponseDto })
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const verifiedChallenge = this.webhookService.verifyMetaChallenge({
      mode,
      verifyToken,
      challenge,
      expectedVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    });

    if (!verifiedChallenge) {
      throw new ForbiddenException('Invalid WhatsApp webhook verification request');
    }

    return verifiedChallenge;
  }

  @Post()
  @HttpCode(200)
  @ApiSecurity('WhatsAppSignature')
  @ApiOperation({
    summary: 'Receive WhatsApp webhook payloads',
    description:
      'Validates the Meta signature when configured, persists inbound message events, and returns an acknowledgement to Meta.',
  })
  @ApiHeader({
    description: 'Meta HMAC SHA-256 signature header. Required in production when WHATSAPP_APP_SECRET is configured.',
    name: 'x-hub-signature-256',
    required: false,
  })
  @ApiBody({ type: WhatsAppWebhookPayloadDto })
  @ApiOkResponse({
    description: 'Webhook payload accepted and processed.',
    type: WhatsAppWebhookResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Webhook signature validation failed.', type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({
    description: 'Webhook signature validation is required but WHATSAPP_APP_SECRET is not configured.',
    type: ErrorResponseDto,
  })
  @ApiResponse({ description: 'Webhook delivery is rate limited.', status: 429, type: ErrorResponseDto })
  async receiveWebhook(
    @Req() request: RawBodyRequest,
    @Headers('x-hub-signature-256') signatureHeader: string | undefined,
    @Body() payload: WhatsAppWebhookPayload,
  ): Promise<WhatsAppWebhookResponse> {
    this.verifySignatureIfConfigured(request.rawBody, signatureHeader);

    const events = await this.webhookService.persistInboundMessages(
      this.webhookService.parseInboundMessages(payload),
    );
    const statusUpdates = await this.webhookService.persistMessageStatusUpdates(
      this.webhookService.parseMessageStatusUpdates(payload),
    );

    for (const event of events) {
      this.logger.log(
        JSON.stringify({
          event: 'whatsapp.webhook.message.received',
          messageId: event.messageId,
          senderPhone: event.senderPhone,
          phoneNumberId: event.phoneNumberId,
          timestamp: event.timestamp,
          messageType: event.messageType,
          duplicate: event.duplicate,
        }),
      );
    }

    if (events.length === 0 && statusUpdates === 0) {
      this.logger.log(
        JSON.stringify({
          event: 'whatsapp.webhook.received',
          message: 'No inbound message or status events found in payload',
        }),
      );
    }

    return { received: true, eventCount: events.length + statusUpdates };
  }

  private verifySignatureIfConfigured(
    rawBody: Buffer | undefined,
    signatureHeader: string | undefined,
  ): void {
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new InternalServerErrorException('WhatsApp app secret is not configured');
      }

      this.logger.warn('WHATSAPP_APP_SECRET is not configured; skipping signature validation');
      return;
    }

    try {
      this.webhookService.assertValidSignature({
        rawBody,
        signatureHeader,
        appSecret,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }
}
