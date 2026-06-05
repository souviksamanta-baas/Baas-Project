import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { InventoryModule } from '../inventory/inventory.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AiController } from './ai.controller';
import { OwnerCopilotService } from './owner-copilot.service';
import { SalesAiService } from './sales-ai.service';

@Module({
  imports: [InventoryModule, WhatsAppModule],
  controllers: [AiController],
  providers: [SupabaseService, OwnerCopilotService, SalesAiService],
  exports: [OwnerCopilotService, SalesAiService],
})
export class AiModule {}
