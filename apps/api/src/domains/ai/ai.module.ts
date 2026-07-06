import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { InventoryModule } from '../inventory/inventory.module';
import { TasksModule } from '../tasks/tasks.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AiController } from './ai.controller';
import { CopiActionService } from './copi-action.service';
import { CopiLlmPhraserService } from './copi-llm-phraser.service';
import { CopiOrchestratorService } from './copi-orchestrator.service';
import { CopiPolicyService } from './copi-policy.service';
import { CopiReportsService } from './copi-reports.service';
import { CopiSessionService } from './copi-session.service';
import { CopiToolRegistry } from './copi-tool-registry';
import { CopiVisionService } from './copi-vision.service';
import { CopiVoiceService } from './copi-voice.service';
import { OwnerCopilotService } from './owner-copilot.service';
import { SalesAiService } from './sales-ai.service';

@Module({
  imports: [InventoryModule, TasksModule, WhatsAppModule],
  controllers: [AiController],
  providers: [
    SupabaseService,
    CopiPolicyService,
    CopiToolRegistry,
    CopiLlmPhraserService,
    CopiSessionService,
    CopiActionService,
    CopiVoiceService,
    CopiVisionService,
    CopiReportsService,
    CopiOrchestratorService,
    OwnerCopilotService,
    SalesAiService,
  ],
  exports: [OwnerCopilotService, SalesAiService],
})
export class AiModule {}
