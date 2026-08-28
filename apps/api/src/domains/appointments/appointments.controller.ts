import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

import { resolveAuthUser } from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';
import { AppointmentsService } from './appointments.service';

class AppointmentInviteEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  startsAt!: string;

  @IsString()
  @MinLength(1)
  endsAt!: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsString()
  fromLabel?: string | null;
}

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post('invite-email')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Send appointment invite email to the Para recipient' })
  @ApiOkResponse({ description: 'Invite email queued/sent.' })
  async inviteEmail(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: AppointmentInviteEmailDto,
  ): Promise<{ ok: true }> {
    try {
      await resolveAuthUser(this.supabaseService, authorizationHeader);
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }

    try {
      await this.appointmentsService.sendInviteEmail({
        endsAt: body.endsAt,
        fromLabel: body.fromLabel ?? null,
        notes: body.notes ?? null,
        startsAt: body.startsAt,
        title: body.title,
        toEmail: body.toEmail,
      });
      return { ok: true };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo enviar la invitación.',
      );
    }
  }
}
