import { Injectable } from '@nestjs/common';

import { CopiOrchestratorService } from './copi-orchestrator.service';
import type { CopiToolName, OwnerCopilotResponse } from './copi.types';

export type { CopiToolName, OwnerCopilotResponse };
export type CopilotToolName = CopiToolName;

@Injectable()
export class OwnerCopilotService {
  constructor(private readonly orchestrator: CopiOrchestratorService) {}

  async answerQuestion(params: {
    authorizationHeader: string | undefined;
    businessCenterId?: string;
    now?: Date;
    organizationId: string;
    question: string;
    sessionId?: string;
  }): Promise<OwnerCopilotResponse> {
    return this.orchestrator.answerQuestion(params);
  }
}
