import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { WhatsAppWebhookController } from './webhooks/whatsapp/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './webhooks/whatsapp/whatsapp-webhook.service';

@Module({
  controllers: [HealthController, WhatsAppWebhookController],
  providers: [WhatsAppWebhookService],
})
export class AppModule {}
