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
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

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

class AssigneeAvailabilityDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  businessCenterId!: string;

  @IsString()
  @MinLength(1)
  startsAt!: string;

  @IsString()
  @MinLength(1)
  endsAt!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds!: string[];

  @IsOptional()
  @IsString()
  excludeAppointmentId?: string | null;
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

  @Post('assignee-availability')
  @HttpCode(200)
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({
    summary: 'Check whether org members are available or busy for an appointment slot',
  })
  @ApiOkResponse({ description: 'Availability per userId.' })
  async assigneeAvailability(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: AssigneeAvailabilityDto,
  ): Promise<{
    members: Array<{ availability: 'available' | 'busy'; userId: string }>;
  }> {
    try {
      await resolveAuthUser(this.supabaseService, authorizationHeader);
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }

    if (new Date(body.endsAt).getTime() <= new Date(body.startsAt).getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    try {
      const members = await this.appointmentsService.getAssigneesAvailability({
        businessCenterId: body.businessCenterId,
        endsAt: body.endsAt,
        excludeAppointmentId: body.excludeAppointmentId ?? null,
        organizationId: body.organizationId,
        startsAt: body.startsAt,
        userIds: body.userIds,
      });
      return { members };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'No se pudo consultar la disponibilidad.',
      );
    }
  }
}
