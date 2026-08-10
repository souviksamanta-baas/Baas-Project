import {
  BadRequestException,
  Body,
  Controller,
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

import {
  EmailOtpRequestDto,
  EmailOtpVerifyDto,
  ErrorResponseDto,
  WhatsAppOtpRequestDto,
  WhatsAppOtpVerifyDto,
} from '../../docs/openapi.dtos';
import { AuthSessionService } from './auth-session.service';
import { PlatformEmailAuthService } from './platform-email-auth.service';
import { PlatformWhatsAppAuthService } from './platform-whatsapp-auth.service';

interface OtpVerifyResponse {
  tokenHash: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly platformWhatsAppAuthService: PlatformWhatsAppAuthService,
    private readonly platformEmailAuthService: PlatformEmailAuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Post('otp/whatsapp/request')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request WhatsApp OTP for login',
    description:
      'Sends a Meta authentication template OTP from the Nexolia platform WABA. Auth phone is independent of merchant WABA numbers.',
  })
  @ApiBody({ type: WhatsAppOtpRequestDto })
  @ApiOkResponse({ description: 'OTP requested.' })
  async requestWhatsAppOtp(@Body() body: WhatsAppOtpRequestDto): Promise<{ ok: true }> {
    try {
      const phoneE164 = normalizePhone(body.phone);
      await this.platformWhatsAppAuthService.requestOtp(phoneE164);
      return { ok: true };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo enviar el código por WhatsApp.',
      );
    }
  }

  @Post('otp/whatsapp/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify WhatsApp OTP and mint Supabase session token',
    description:
      'Validates the OTP challenge and returns a Supabase token hash the mobile client can exchange for a session.',
  })
  @ApiBody({ type: WhatsAppOtpVerifyDto })
  @ApiOkResponse({ description: 'OTP verified; session token hash returned.' })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired OTP.',
    type: ErrorResponseDto,
  })
  async verifyWhatsAppOtp(
    @Body() body: WhatsAppOtpVerifyDto,
  ): Promise<OtpVerifyResponse> {
    let phoneE164: string;
    let isValid: boolean;

    try {
      phoneE164 = normalizePhone(body.phone);
      isValid = await this.platformWhatsAppAuthService.verifyOtp({
        code: body.code,
        phoneE164,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo verificar el código.',
      );
    }

    if (!isValid) {
      throw new UnauthorizedException('Código inválido.');
    }

    const tokenHash = await this.authSessionService.createSessionTokenHashForPhone(phoneE164);
    return { tokenHash };
  }

  @Post('otp/email/request')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request email OTP for login',
    description:
      'Sends a 6-digit login code via Resend from the Nexolia platform mailer. Does not use Supabase Auth SMTP.',
  })
  @ApiBody({ type: EmailOtpRequestDto })
  @ApiOkResponse({ description: 'OTP requested.' })
  async requestEmailOtp(@Body() body: EmailOtpRequestDto): Promise<{ ok: true }> {
    try {
      await this.platformEmailAuthService.requestOtp(body.email);
      return { ok: true };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo enviar el código.',
      );
    }
  }

  @Post('otp/email/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify email OTP and mint Supabase session token',
    description:
      'Validates the Nest-owned email OTP challenge and returns a Supabase token hash the mobile client can exchange for a session.',
  })
  @ApiBody({ type: EmailOtpVerifyDto })
  @ApiOkResponse({ description: 'OTP verified; session token hash returned.' })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired OTP.',
    type: ErrorResponseDto,
  })
  async verifyEmailOtp(@Body() body: EmailOtpVerifyDto): Promise<OtpVerifyResponse> {
    let isValid: boolean;
    try {
      isValid = await this.platformEmailAuthService.verifyOtp({
        code: body.code,
        email: body.email,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo verificar el código.',
      );
    }

    if (!isValid) {
      throw new UnauthorizedException('Código inválido.');
    }

    const tokenHash = await this.authSessionService.createSessionTokenHashForEmail(body.email);
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
