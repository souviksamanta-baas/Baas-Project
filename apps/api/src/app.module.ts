import { Module } from '@nestjs/common';

import { DomainModule } from './domains/domain.module';
import { HealthController } from './health.controller';
import { SupabaseService } from './supabase/supabase.service';
import { WhatsAppMessageEventRepository } from './webhooks/whatsapp/whatsapp-message-event.repository';
import { WhatsAppWebhookController } from './webhooks/whatsapp/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './webhooks/whatsapp/whatsapp-webhook.service';

@Module({
  imports: [DomainModule],
  controllers: [HealthController, WhatsAppWebhookController],
  providers: [SupabaseService, WhatsAppMessageEventRepository, WhatsAppWebhookService],
})
export class AppModule {}
