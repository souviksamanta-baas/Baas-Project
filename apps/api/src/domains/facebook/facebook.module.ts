import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { FacebookConnectionService } from './facebook-connection.service';
import { FacebookEventProcessor } from './facebook-event-processor.service';
import { FacebookMessagingService } from './facebook-messaging.service';
import { FacebookOAuthRedirectController } from './facebook-oauth-redirect.controller';
import { FacebookOAuthService } from './facebook-oauth.service';
import { FacebookController } from './facebook.controller';
import {
  FacebookWebhookAliasController,
  MetaFacebookWebhookController,
} from './facebook-webhook.controller';
import { FacebookWebhookService } from './facebook-webhook.service';

@Module({
  controllers: [
    FacebookController,
    FacebookOAuthRedirectController,
    MetaFacebookWebhookController,
    FacebookWebhookAliasController,
  ],
  providers: [
    SupabaseService,
    FacebookConnectionService,
    FacebookEventProcessor,
    FacebookMessagingService,
    FacebookOAuthService,
    FacebookWebhookService,
  ],
  imports: [NotificationsModule],
  exports: [
    FacebookConnectionService,
    FacebookMessagingService,
    FacebookOAuthService,
    FacebookWebhookService,
  ],
})
export class FacebookModule {}
