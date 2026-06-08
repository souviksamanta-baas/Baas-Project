import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  ApproveDraftRequestDto,
  CopilotQuestionRequestDto,
  DraftRejectedResponseDto,
  DraftSentResponseDto,
  ErrorResponseDto,
  OwnerCopilotResponseDto,
} from '../../docs/openapi.dtos';
import { OwnerCopilotService, type OwnerCopilotResponse } from './owner-copilot.service';
import { SalesAiService } from './sales-ai.service';

@ApiTags('AI')
@ApiBearerAuth('SupabaseAuth')
@Controller('ai')
export class AiController {
  constructor(
    private readonly salesAiService: SalesAiService,
    private readonly ownerCopilotService: OwnerCopilotService,
  ) {}

  @Post('drafts/:draftId/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Approve and send an AI draft',
    description:
      'Owner-secured endpoint that approves an AI draft, optionally applies edited copy, and sends the reply to the conversation contact.',
  })
  @ApiParam({ description: 'AI draft UUID.', name: 'draftId' })
  @ApiBody({ type: ApproveDraftRequestDto })
  @ApiOkResponse({ description: 'Draft was approved and sent.', type: DraftSentResponseDto })
  @ApiUnauthorizedResponse({ description: 'The Supabase authorization token is missing or invalid.', type: ErrorResponseDto })
  async approveDraft(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('draftId') draftId: string,
    @Body() body: ApproveDraftRequestDto,
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
  @ApiOperation({
    summary: 'Reject an AI draft',
    description: 'Owner-secured endpoint that marks a pending AI draft as rejected without sending it.',
  })
  @ApiParam({ description: 'AI draft UUID.', name: 'draftId' })
  @ApiOkResponse({ description: 'Draft was rejected.', type: DraftRejectedResponseDto })
  @ApiUnauthorizedResponse({ description: 'The Supabase authorization token is missing or invalid.', type: ErrorResponseDto })
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
  @ApiOperation({
    summary: 'Ask Copi an owner question',
    description:
      'Owner-secured endpoint that answers operational business questions using the available dashboard tools.',
  })
  @ApiBody({ type: CopilotQuestionRequestDto })
  @ApiOkResponse({ description: 'Copi answered the owner question.', type: OwnerCopilotResponseDto })
  @ApiUnauthorizedResponse({ description: 'The Supabase authorization token is missing or invalid.', type: ErrorResponseDto })
  async answerCopilotQuestion(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CopilotQuestionRequestDto,
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
