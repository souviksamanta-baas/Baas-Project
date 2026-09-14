import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsOptional, IsString, Length, MinLength } from 'class-validator';

import { SkipOrgMembership } from '../../auth/auth.decorators';
import { ErrorResponseDto } from '../../docs/openapi.dtos';
import {
  IdentityLinkService,
  type IdentityMeResponse,
  type IdentityVerifyResponse,
} from './identity-link.service';

class IdentityEmailRequestDto {
  @IsString()
  @MinLength(5)
  email!: string;
}

class IdentityEmailVerifyDto {
  @IsString()
  @MinLength(5)
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

class IdentityPhoneRequestDto {
  @IsString()
  @MinLength(8)
  phone!: string;
}

class IdentityPhoneVerifyDto {
  @IsString()
  @MinLength(8)
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

class IdentityConfirmMergeDto {
  @IsString()
  @MinLength(16)
  mergeToken!: string;

  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

@SkipOrgMembership()
@ApiTags('Auth Identities')
@ApiBearerAuth('SupabaseAuth')
@Controller('auth/identities')
export class IdentityController {
  constructor(private readonly identityLinkService: IdentityLinkService) {}

  @Get('me')
  @ApiOperation({ summary: 'Verified login identities for the current owner' })
  @ApiOkResponse({ description: 'Email/phone verification state.' })
  async me(
    @Headers('authorization') authorizationHeader: string | undefined,
  ): Promise<IdentityMeResponse> {
    return this.identityLinkService.getMe(authorizationHeader);
  }

  @Post('email/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request OTP to link an email to the current owner account',
  })
  @ApiBody({ type: IdentityEmailRequestDto })
  async requestEmail(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: IdentityEmailRequestDto,
  ): Promise<{ ok: true }> {
    try {
      return await this.identityLinkService.requestEmailLink(
        authorizationHeader,
        body.email,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo enviar el código.',
      );
    }
  }

  @Post('email/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify email OTP and attach or preview merge (no session mint)',
  })
  @ApiBody({ type: IdentityEmailVerifyDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async verifyEmail(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: IdentityEmailVerifyDto,
  ): Promise<IdentityVerifyResponse> {
    try {
      return await this.identityLinkService.verifyEmailLink(authorizationHeader, {
        code: body.code,
        email: body.email,
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo verificar el código.',
      );
    }
  }

  @Post('phone/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request SMS OTP to link a phone to the current owner account',
  })
  @ApiBody({ type: IdentityPhoneRequestDto })
  async requestPhone(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: IdentityPhoneRequestDto,
  ): Promise<{ ok: true }> {
    try {
      return await this.identityLinkService.requestPhoneLink(
        authorizationHeader,
        body.phone,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo enviar el código.',
      );
    }
  }

  @Post('phone/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify SMS OTP and attach or preview merge (no session mint)',
  })
  @ApiBody({ type: IdentityPhoneVerifyDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async verifyPhone(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: IdentityPhoneVerifyDto,
  ): Promise<IdentityVerifyResponse> {
    try {
      return await this.identityLinkService.verifyPhoneLink(authorizationHeader, {
        code: body.code,
        phone: body.phone,
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo verificar el código.',
      );
    }
  }

  /** @deprecated Prefer /auth/identities/phone/* — SMS, not WhatsApp. */
  @Post('whatsapp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Deprecated alias: request SMS OTP to link a phone',
    deprecated: true,
  })
  @ApiBody({ type: IdentityPhoneRequestDto })
  async requestWhatsApp(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: IdentityPhoneRequestDto,
  ): Promise<{ ok: true }> {
    return this.requestPhone(authorizationHeader, body);
  }

  /** @deprecated Prefer /auth/identities/phone/* — SMS, not WhatsApp. */
  @Post('whatsapp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Deprecated alias: verify SMS OTP for phone link',
    deprecated: true,
  })
  @ApiBody({ type: IdentityPhoneVerifyDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async verifyWhatsApp(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: IdentityPhoneVerifyDto,
  ): Promise<IdentityVerifyResponse> {
    return this.verifyPhone(authorizationHeader, body);
  }

  @Post('confirm-merge')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Confirm merge of donor account into the current session after OTP preview',
  })
  @ApiBody({ type: IdentityConfirmMergeDto })
  async confirmMerge(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: IdentityConfirmMergeDto,
  ): Promise<{ identities: IdentityMeResponse; status: 'linked' }> {
    if (body.confirm === false) {
      throw new BadRequestException('Confirmá la unificación para continuar.');
    }

    try {
      return await this.identityLinkService.confirmMerge(
        authorizationHeader,
        body.mergeToken,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo unificar las cuentas.',
      );
    }
  }
}
