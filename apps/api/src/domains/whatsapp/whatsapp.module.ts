import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { WhatsAppConversationMessageRepository } from './whatsapp-conversation-message.repository';
import { WhatsAppOutboundMessageService } from './whatsapp-outbound-message.service';

@Module({
  providers: [
    SupabaseService,
    WhatsAppConnectionService,
    WhatsAppConversationMessageRepository,
    WhatsAppOutboundMessageService,
  ],
  exports: [
    WhatsAppConnectionService,
    WhatsAppConversationMessageRepository,
    WhatsAppOutboundMessageService,
  ],
})
export class WhatsAppModule {}
