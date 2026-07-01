import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppConversationMessageRepository } from './whatsapp-conversation-message.repository';
import { WhatsAppMessagingService } from './whatsapp-messaging.service';
import { WhatsAppOutboundMessageService } from './whatsapp-outbound-message.service';

@Module({
  controllers: [WhatsAppController],
  providers: [
    SupabaseService,
    WhatsAppConnectionService,
    WhatsAppConversationMessageRepository,
    WhatsAppMessagingService,
    WhatsAppOutboundMessageService,
  ],
  exports: [
    WhatsAppConnectionService,
    WhatsAppConversationMessageRepository,
    WhatsAppMessagingService,
    WhatsAppOutboundMessageService,
  ],
})
export class WhatsAppModule {}
