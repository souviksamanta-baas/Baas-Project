import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { InstagramConnectionService } from './instagram-connection.service';
import { InstagramEventProcessor } from './instagram-event-processor.service';
import { InstagramHistorySyncService } from './instagram-history-sync.service';
import { InstagramMessagingService } from './instagram-messaging.service';
import { InstagramOAuthRedirectController } from './instagram-oauth-redirect.controller';
import { InstagramOAuthService } from './instagram-oauth.service';
import { InstagramController } from './instagram.controller';
import {
  InstagramWebhookAliasController,
  MetaInstagramWebhookController,
} from './instagram-webhook.controller';
import { InstagramWebhookService } from './instagram-webhook.service';

@Module({
  controllers: [
    InstagramController,
    InstagramOAuthRedirectController,
    MetaInstagramWebhookController,
    InstagramWebhookAliasController,
  ],
  providers: [
    SupabaseService,
    InstagramConnectionService,
    InstagramEventProcessor,
    InstagramHistorySyncService,
    InstagramMessagingService,
    InstagramOAuthService,
    InstagramWebhookService,
  ],
  exports: [
    InstagramConnectionService,
    InstagramMessagingService,
    InstagramOAuthService,
    InstagramWebhookService,
  ],
})
export class InstagramModule {}
