import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { SalesAiService } from './sales-ai.service';

interface ApproveDraftBody {
  body?: string;
}

@Controller('ai/drafts')
export class AiController {
  constructor(private readonly salesAiService: SalesAiService) {}

  @Post(':draftId/approve')
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

  @Post(':draftId/reject')
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
}
