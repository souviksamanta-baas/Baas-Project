import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
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
  assertOrgMembership,
  resolveUserId,
} from '../../auth/request-auth.helper';
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
import { SupabaseService } from '../../supabase/supabase.service';
import { CopiActionService } from './copi-action.service';
import { CopiPolicyService } from './copi-policy.service';
import { CopiReportsService } from './copi-reports.service';
import { CopiSessionService } from './copi-session.service';
import { CopiVisionService } from './copi-vision.service';
import { CopiVoiceService } from './copi-voice.service';
import { OwnerCopilotService, type OwnerCopilotResponse } from './owner-copilot.service';
import { SalesAiService } from './sales-ai.service';

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
      this.rethrowAuthError(error);
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
      this.rethrowAuthError(error);
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
        throw new BadRequestException('organizationId is required');
      }

      if (!body.question?.trim()) {
        throw new BadRequestException('question is required');
      }

      return await this.ownerCopilotService.answerQuestion({
        authorizationHeader,
        businessCenterId: body.businessCenterId,
        documentContext: body.documentContext,
        imageContext: body.imageContext,
        organizationId: body.organizationId,
        question: body.question,
        sessionId: body.sessionId,
      });
    } catch (error) {
      this.rethrowAuthError(error);
    }
  }

  @Get('copilot/session/active')
  @ApiOperation({
    summary: 'Get the owner’s active Copi chat thread (last 14 days)',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async getActiveCopiSession(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('organizationId') organizationId: string,
    @Query('businessCenterId') businessCenterId?: string,
  ): Promise<{
    messages: Awaited<ReturnType<CopiSessionService['listMessages']>>;
    sessionId: string | null;
  }> {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    const userId = await this.requireOrgMember(authorizationHeader, organizationId);
    return this.sessionService.getActiveThread({
      businessCenterId: businessCenterId?.trim() || undefined,
      organizationId,
      userId,
    });
  }

  @Get('copilot/sessions/:sessionId/messages')
  @ApiOperation({ summary: 'List Copi session messages' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async listCopiSessionMessages(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('sessionId') sessionId: string,
    @Query('organizationId') organizationId: string,
  ): Promise<{ messages: Awaited<ReturnType<CopiSessionService['listMessages']>> }> {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    const userId = await this.requireOrgMember(authorizationHeader, organizationId);
    const messages = await this.sessionService.listMessages(sessionId, organizationId, userId);
    return { messages };
  }

  @Post('copilot/actions/:actionId/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a proposed Copi action' })
  @ApiBody({ type: CopiActionConfirmRequestDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async confirmCopiAction(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('actionId') actionId: string,
    @Body() body: CopiActionConfirmRequestDto,
  ): Promise<{ result: Record<string, unknown>; status: 'executed' }> {
    try {
      if (!body.organizationId?.trim()) {
        throw new BadRequestException('organizationId is required');
      }

      const userId = await this.requireOrgMember(authorizationHeader, body.organizationId);
      return await this.actionService.confirmAction({
        actionId,
        businessCenterId: body.businessCenterId,
        organizationId: body.organizationId,
        userId,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Error && error.message.toLocaleLowerCase().includes('token')) {
        throw new UnauthorizedException(error.message);
      }

      // Domain Errors (invalid UUID snooze, DB failures, etc.) must not become
      // Nest's opaque 500 "Internal server error" — surface them to the client.
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo confirmar la acción',
      );
    }
  }

  @Post('copilot/voice')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Transcribe a Copi voice note' })
  @ApiBody({ type: CopiVoiceRequestDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async transcribeVoice(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CopiVoiceRequestDto,
  ): Promise<{ text: string }> {
    await this.requireOrgMember(authorizationHeader, body.organizationId);
    const flags = await this.policyService.loadFeatureFlags(body.organizationId);
    return this.voiceService.transcribe({
      audioBase64: body.audioBase64,
      featureFlags: flags,
      mimeType: body.mimeType,
      organizationId: body.organizationId,
    });
  }

  @Post('copilot/voice/upload')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } }))
  @ApiOperation({ summary: 'Transcribe a Copi voice note from multipart upload' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async transcribeVoiceUpload(
    @Headers('authorization') authorizationHeader: string | undefined,
    @UploadedFile() file: UploadedAudioFile,
    @Body('organizationId') organizationId: string,
  ): Promise<{ text: string }> {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    await this.requireOrgMember(authorizationHeader, organizationId);

    if (!file?.buffer?.length) {
      return { text: '' };
    }

    const flags = await this.policyService.loadFeatureFlags(organizationId);
    return this.voiceService.transcribeBuffer({
      audioBuffer: file.buffer,
      featureFlags: flags,
      mimeType: file.mimetype || 'audio/m4a',
      organizationId,
    });
  }

  @Post('copilot/vision')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Analyze an image for Copi actions' })
  @ApiBody({ type: CopiVisionRequestDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async analyzeVision(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CopiVisionRequestDto,
  ): Promise<{ extraction: Record<string, unknown>; summary: string }> {
    await this.requireOrgMember(authorizationHeader, body.organizationId);
    const flags = await this.policyService.loadFeatureFlags(body.organizationId);
    return this.visionService.extract({
      featureFlags: flags,
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      organizationId: body.organizationId,
      prompt: body.prompt,
    });
  }

  @Post('copilot/reports/run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run a saved or built-in Copi report' })
  @ApiBody({ type: CopiReportRunRequestDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async runCopiReport(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CopiReportRunRequestDto,
  ): Promise<Record<string, unknown>> {
    await this.requireOrgMember(authorizationHeader, body.organizationId);
    const flags = await this.policyService.loadFeatureFlags(body.organizationId);
    return this.reportsService.runReport({
      businessCenterId: body.businessCenterId,
      featureFlags: flags,
      organizationId: body.organizationId,
      parameters: body.parameters,
      reportKey: body.reportKey,
    });
  }

  @Get('copilot/custom-questions')
  @ApiOperation({ summary: 'List saved Copi custom questions for the owner' })
  async listCustomQuestions(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('organizationId') organizationId: string,
  ): Promise<{ questions: Array<{ id: string; label: string; question: string }> }> {
    const userId = await this.requireOrgMember(authorizationHeader, organizationId);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('copi_custom_questions')
      .select('id, label, question')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      throw new BadRequestException(error.message);
    }
    return {
      questions: ((data ?? []) as Array<{ id: string; label: string; question: string }>).map(
        (row) => ({
          id: row.id,
          label: row.label,
          question: row.question,
        }),
      ),
    };
  }

  @Post('copilot/custom-questions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Save a Copi custom question chip' })
  async saveCustomQuestion(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body()
    body: {
      businessCenterId?: string;
      label?: string;
      organizationId: string;
      question: string;
    },
  ): Promise<{ id: string }> {
    const userId = await this.requireOrgMember(authorizationHeader, body.organizationId);
    const question = body.question?.trim();
    if (!question) {
      throw new BadRequestException('question is required');
    }
    const label = (body.label?.trim() || question).slice(0, 48);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('copi_custom_questions')
      .upsert(
        {
          business_center_id: body.businessCenterId ?? null,
          label,
          organization_id: body.organizationId,
          question,
          user_id: userId,
        },
        { onConflict: 'organization_id,user_id,question' },
      )
      .select('id')
      .single<{ id: string }>();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'No se pudo guardar la pregunta');
    }
    return { id: data.id };
  }

  private async requireOrgMember(
    authorizationHeader: string | undefined,
    organizationId: string | undefined,
  ): Promise<string> {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    const userId = await resolveUserId(this.supabaseService, authorizationHeader);
    await assertOrgMembership({
      organizationId: organizationId.trim(),
      supabaseService: this.supabaseService,
      userId,
    });
    return userId;
  }

  private rethrowAuthError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (error instanceof Error && error.message.toLocaleLowerCase().includes('token')) {
      throw new UnauthorizedException(error.message);
    }

    if (error instanceof Error && /member|forbidden|owner/i.test(error.message)) {
      throw new ForbiddenException(error.message);
    }

    throw error;
  }
}
