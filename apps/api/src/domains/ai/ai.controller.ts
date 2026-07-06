import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  CopiActionConfirmRequestDto,
  CopiReportRunRequestDto,
  CopiVisionRequestDto,
  CopiVoiceRequestDto,
  CopilotQuestionRequestDto,
  DraftRejectedResponseDto,
  DraftSentResponseDto,
  ErrorResponseDto,
  OwnerCopilotResponseDto,
} from '../../docs/openapi.dtos';
import { CopiActionService } from './copi-action.service';
import { CopiPolicyService } from './copi-policy.service';
import { CopiReportsService } from './copi-reports.service';
import { CopiSessionService } from './copi-session.service';
import { CopiVisionService } from './copi-vision.service';
import { CopiVoiceService } from './copi-voice.service';
import { OwnerCopilotService, type OwnerCopilotResponse } from './owner-copilot.service';
import { SalesAiService } from './sales-ai.service';
import { SupabaseService } from '../../supabase/supabase.service';

interface UploadedAudioFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@ApiTags('AI')
@ApiBearerAuth('SupabaseAuth')
@Controller('ai')
export class AiController {
  constructor(
    private readonly salesAiService: SalesAiService,
    private readonly ownerCopilotService: OwnerCopilotService,
    private readonly actionService: CopiActionService,
    private readonly sessionService: CopiSessionService,
    private readonly policyService: CopiPolicyService,
    private readonly voiceService: CopiVoiceService,
    private readonly visionService: CopiVisionService,
    private readonly reportsService: CopiReportsService,
    private readonly supabaseService: SupabaseService,
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
        businessCenterId: body.businessCenterId,
        organizationId: body.organizationId,
        question: body.question,
        sessionId: body.sessionId,
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLocaleLowerCase().includes('token')) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }

  @Get('copilot/sessions/:sessionId/messages')
  @ApiOperation({ summary: 'List Copi session messages' })
  async listCopiSessionMessages(
    @Param('sessionId') sessionId: string,
    @Query('organizationId') organizationId: string,
  ): Promise<{ messages: Awaited<ReturnType<CopiSessionService['listMessages']>> }> {
    if (!organizationId?.trim()) {
      throw new Error('organizationId is required');
    }

    const messages = await this.sessionService.listMessages(sessionId, organizationId);
    return { messages };
  }

  @Post('copilot/actions/:actionId/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a proposed Copi action' })
  @ApiBody({ type: CopiActionConfirmRequestDto })
  async confirmCopiAction(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('actionId') actionId: string,
    @Body() body: CopiActionConfirmRequestDto,
  ): Promise<{ result: Record<string, unknown>; status: 'executed' }> {
    const userId = await this.resolveUserId(authorizationHeader);
    return this.actionService.confirmAction({
      actionId,
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      userId,
    });
  }

  @Post('copilot/voice')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transcribe a Copi voice note' })
  @ApiBody({ type: CopiVoiceRequestDto })
  async transcribeVoice(
    @Body() body: CopiVoiceRequestDto,
  ): Promise<{ text: string }> {
    const flags = await this.policyService.loadFeatureFlags(body.organizationId);
    return this.voiceService.transcribe({
      audioBase64: body.audioBase64,
      featureFlags: flags,
      mimeType: body.mimeType,
    });
  }

  @Post('copilot/voice/upload')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 12 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Transcribe a Copi voice note from multipart upload' })
  async transcribeVoiceUpload(
    @UploadedFile() file: UploadedAudioFile,
    @Body('organizationId') organizationId: string,
  ): Promise<{ text: string }> {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    if (!file?.buffer?.length) {
      return { text: '' };
    }

    const flags = await this.policyService.loadFeatureFlags(organizationId);
    return this.voiceService.transcribeBuffer({
      audioBuffer: file.buffer,
      featureFlags: flags,
      mimeType: file.mimetype || 'audio/m4a',
    });
  }

  @Post('copilot/vision')
  @HttpCode(200)
  @ApiOperation({ summary: 'Analyze an image for Copi actions' })
  @ApiBody({ type: CopiVisionRequestDto })
  async analyzeVision(
    @Body() body: CopiVisionRequestDto,
  ): Promise<{ extraction: Record<string, unknown>; summary: string }> {
    const flags = await this.policyService.loadFeatureFlags(body.organizationId);
    return this.visionService.extract({
      featureFlags: flags,
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      prompt: body.prompt,
    });
  }

  @Post('copilot/reports/run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run a saved or built-in Copi report' })
  @ApiBody({ type: CopiReportRunRequestDto })
  async runCopiReport(
    @Body() body: CopiReportRunRequestDto,
  ): Promise<Record<string, unknown>> {
    const flags = await this.policyService.loadFeatureFlags(body.organizationId);
    return this.reportsService.runReport({
      businessCenterId: body.businessCenterId,
      featureFlags: flags,
      organizationId: body.organizationId,
      parameters: body.parameters,
      reportKey: body.reportKey,
    });
  }

  private async resolveUserId(authorizationHeader: string | undefined): Promise<string> {
    const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    return data.user.id;
  }
}
