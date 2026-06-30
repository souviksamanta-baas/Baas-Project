import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ErrorResponseDto } from '../../docs/openapi.dtos';
import { AuthSessionService } from './auth-session.service';
import { PlatformWhatsAppAuthService } from './platform-whatsapp-auth.service';

interface WhatsAppOtpRequestBody {
  phone: string;
}

interface WhatsAppOtpVerifyBody {
  code: string;
  phone: string;
}

interface WhatsAppOtpVerifyResponse {
  tokenHash: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly platformWhatsAppAuthService: PlatformWhatsAppAuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Post('otp/whatsapp/request')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request WhatsApp OTP for login',
    description:
      'Sends a Meta authentication template OTP from the Nexolia platform WABA. Auth phone is independent of merchant WABA numbers.',
  })
  @ApiBody({
    schema: {
      properties: {
        phone: { example: '+5491112345678', type: 'string' },
      },
      required: ['phone'],
      type: 'object',
    },
  })
  @ApiOkResponse({ description: 'OTP requested.' })
  async requestWhatsAppOtp(@Body() body: WhatsAppOtpRequestBody): Promise<{ ok: true }> {
    const phoneE164 = normalizePhone(body.phone);
    await this.platformWhatsAppAuthService.requestOtp(phoneE164);
    return { ok: true };
  }

  @Post('otp/whatsapp/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify WhatsApp OTP and mint Supabase session token',
    description:
      'Validates the OTP challenge and returns a Supabase token hash the mobile client can exchange for a session.',
  })
  @ApiBody({
    schema: {
      properties: {
        code: { example: '123456', type: 'string' },
        phone: { example: '+5491112345678', type: 'string' },
      },
      required: ['code', 'phone'],
      type: 'object',
    },
  })
  @ApiOkResponse({ description: 'OTP verified; session token hash returned.' })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired OTP.',
    type: ErrorResponseDto,
  })
  async verifyWhatsAppOtp(
    @Body() body: WhatsAppOtpVerifyBody,
  ): Promise<WhatsAppOtpVerifyResponse> {
    const phoneE164 = normalizePhone(body.phone);
    const isValid = await this.platformWhatsAppAuthService.verifyOtp({
      code: body.code,
      phoneE164,
    });

    if (!isValid) {
      throw new UnauthorizedException('Código inválido.');
    }

    const tokenHash = await this.authSessionService.createSessionTokenHashForPhone(phoneE164);
    return { tokenHash };
  }
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();

  if (!trimmed.startsWith('+')) {
    throw new Error('Enter phone in E.164 format (e.g. +54911…).');
  }

  return trimmed;
}
