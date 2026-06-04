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
import type { Request } from 'express';

import {
  InvalidWebhookSignatureError,
  WhatsAppWebhookService,
} from './whatsapp-webhook.service';
import {
  WhatsAppWebhookPayload,
  WhatsAppWebhookResponse,
} from './whatsapp-webhook.types';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly webhookService: WhatsAppWebhookService) {}

  @Get()
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
  async receiveWebhook(
    @Req() request: RawBodyRequest,
    @Headers('x-hub-signature-256') signatureHeader: string | undefined,
    @Body() payload: WhatsAppWebhookPayload,
  ): Promise<WhatsAppWebhookResponse> {
    this.verifySignatureIfConfigured(request.rawBody, signatureHeader);

    const events = await this.webhookService.persistInboundMessages(
      this.webhookService.parseInboundMessages(payload),
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

    if (events.length === 0) {
      this.logger.log(
        JSON.stringify({
          event: 'whatsapp.webhook.received',
          message: 'No inbound message events found in payload',
        }),
      );
    }

    return { received: true, eventCount: events.length };
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
