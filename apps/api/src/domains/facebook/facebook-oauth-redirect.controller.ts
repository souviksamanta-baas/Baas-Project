import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { FacebookOAuthService } from './facebook-oauth.service';

/**
 * Public Meta OAuth redirect target (HTTPS). Facebook Login rejects custom
 * schemes like baas-owner:// — this endpoint bridges to the app deep link.
 *
 * Register in Meta:
 * App Dashboard → Facebook Login for Business → Settings → Valid OAuth Redirect URIs:
 *   https://<api-host>/integrations/meta/facebook/oauth/callback
 */
@ApiExcludeController()
@Controller('integrations/meta/facebook/oauth/callback')
export class FacebookOAuthRedirectController {
  constructor(private readonly oauthService: FacebookOAuthService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  bridge(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_reason') errorReason?: string,
    @Query('error_description') errorDescription?: string,
  ): void {
    const deepLink = this.oauthService.buildAppDeepLink({
      code,
      error,
      errorDescription: errorDescription ?? errorReason,
      state,
    });
    res.redirect(302, deepLink);
  }
}
