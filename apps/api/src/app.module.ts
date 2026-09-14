import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { OrgMembershipGuard } from './auth/org-membership.guard';
import { getRateLimitMax, getRateLimitTtl } from './config/api-config';
import { envValidationSchema } from './config/env.validation';
import { WhatsAppConversationMessageRepository } from './domains/whatsapp/whatsapp-conversation-message.repository';
import { DomainModule } from './domains/domain.module';
import { HealthController } from './health.controller';
import { SupabaseService } from './supabase/supabase.service';
import { WhatsAppMessageEventRepository } from './webhooks/whatsapp/whatsapp-message-event.repository';
import { WhatsAppWebhookController } from './webhooks/whatsapp/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './webhooks/whatsapp/whatsapp-webhook.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          limit: getRateLimitMax(configService),
          ttl: getRateLimitTtl(configService),
        },
      ],
    }),
    DomainModule,
  ],
  controllers: [HealthController, WhatsAppWebhookController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrgMembershipGuard,
    },
    SupabaseService,
    WhatsAppMessageEventRepository,
    WhatsAppConversationMessageRepository,
    WhatsAppWebhookService,
  ],
})
export class AppModule {}