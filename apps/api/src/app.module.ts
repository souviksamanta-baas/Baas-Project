import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { SupabaseService } from './supabase/supabase.service';
import { WhatsAppWebhookController } from './webhooks/whatsapp/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './webhooks/whatsapp/whatsapp-webhook.service';

@Module({
  controllers: [HealthController, WhatsAppWebhookController],
  providers: [SupabaseService, WhatsAppWebhookService],
})
export class AppModule {}
