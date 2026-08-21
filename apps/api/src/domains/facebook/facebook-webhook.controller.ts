import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  type RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { FacebookWebhookService } from './facebook-webhook.service';

@ApiExcludeController()
@Controller('integrations/meta/facebook/webhook')
export class MetaFacebookWebhookController {
  constructor(private readonly webhookService: FacebookWebhookService) {}

  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    return this.webhookService.verifyChallenge({ challenge, mode, verifyToken });
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signatureHeader?: string,
  ): Promise<{ accepted: true; queued: number }> {
    if (!request.rawBody) {
      throw new UnauthorizedException('Missing raw request body');
    }
    return this.webhookService.handleWebhook({
      rawBody: request.rawBody,
      signatureHeader,
    });
  }
}

@ApiExcludeController()
@Controller('webhooks/facebook')
export class FacebookWebhookAliasController {
  constructor(private readonly webhookService: FacebookWebhookService) {}

  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    return this.webhookService.verifyChallenge({ challenge, mode, verifyToken });
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signatureHeader?: string,
  ): Promise<{ accepted: true; queued: number }> {
    if (!request.rawBody) {
      throw new UnauthorizedException('Missing raw request body');
    }
    return this.webhookService.handleWebhook({
      rawBody: request.rawBody,
      signatureHeader,
    });
  }
}
