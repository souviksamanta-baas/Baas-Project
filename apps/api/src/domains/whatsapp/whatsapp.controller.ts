import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ErrorResponseDto } from '../../docs/openapi.dtos';
import {
  WhatsAppConnectionService,
  type WhatsAppConnectionSummary,
} from './whatsapp-connection.service';

interface RegisterWhatsAppConnectionBody {
  displayPhoneNumber: string;
  organizationId: string;
  phoneNumberId: string;
  wabaId?: string;
}

@ApiTags('WhatsApp')
@ApiBearerAuth('SupabaseAuth')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly connectionService: WhatsAppConnectionService) {}

  @Post('connection/register')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Register WhatsApp Business connection',
    description:
      'Owner-secured endpoint that validates Meta phone number metadata and stores tenant WhatsApp configuration.',
  })
  @ApiBody({
    schema: {
      properties: {
        displayPhoneNumber: { example: '+54 9 11 6000-0000', type: 'string' },
        organizationId: { example: '00000000-0000-0000-0000-000000000001', type: 'string' },
        phoneNumberId: { example: '123456789012345', type: 'string' },
        wabaId: { example: '987654321098765', type: 'string' },
      },
      required: ['displayPhoneNumber', 'organizationId', 'phoneNumberId'],
      type: 'object',
    },
  })
  @ApiOkResponse({ description: 'WhatsApp connection registered.' })
  @ApiUnauthorizedResponse({
    description: 'The Supabase authorization token is missing or invalid.',
    type: ErrorResponseDto,
  })
  async registerConnection(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: RegisterWhatsAppConnectionBody,
  ): Promise<WhatsAppConnectionSummary> {
    try {
      if (!body.organizationId?.trim()) {
        throw new Error('organizationId is required');
      }

      if (!body.phoneNumberId?.trim()) {
        throw new Error('phoneNumberId is required');
      }

      if (!body.displayPhoneNumber?.trim()) {
        throw new Error('displayPhoneNumber is required');
      }

      return await this.connectionService.registerConnection({
        authorizationHeader,
        displayPhoneNumber: body.displayPhoneNumber,
        organizationId: body.organizationId,
        phoneNumberId: body.phoneNumberId,
        wabaId: body.wabaId,
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLocaleLowerCase().includes('token')) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }
}
