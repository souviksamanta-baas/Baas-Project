import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { OwnerCopilotService, type OwnerCopilotResponse } from './owner-copilot.service';
import { SalesAiService } from './sales-ai.service';

interface ApproveDraftBody {
  body?: string;
}

interface CopilotQuestionBody {
  organizationId?: string;
  question?: string;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly salesAiService: SalesAiService,
    private readonly ownerCopilotService: OwnerCopilotService,
  ) {}

  @Post('drafts/:draftId/approve')
  @HttpCode(200)
  async approveDraft(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('draftId') draftId: string,
    @Body() body: ApproveDraftBody,
  ): Promise<{ status: 'sent' }> {
    try {
      return await this.salesAiService.approveDraft({
        authorizationHeader,
        draftId,
        editedBody: body.body,
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLocaleLowerCase().includes('token')) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }

  @Post('drafts/:draftId/reject')
  @HttpCode(200)
  async rejectDraft(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('draftId') draftId: string,
  ): Promise<{ status: 'rejected' }> {
    try {
      return await this.salesAiService.rejectDraft({
        authorizationHeader,
        draftId,
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLocaleLowerCase().includes('token')) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }

  @Post('copilot/query')
  @HttpCode(200)
  async answerCopilotQuestion(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CopilotQuestionBody,
  ): Promise<OwnerCopilotResponse> {
    try {
      if (!body.organizationId?.trim()) {
        throw new Error('organizationId is required');
      }

      if (!body.question?.trim()) {
        throw new Error('question is required');
      }

      return await this.ownerCopilotService.answerQuestion({
        authorizationHeader,
        organizationId: body.organizationId,
        question: body.question,
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLocaleLowerCase().includes('token')) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }
}
