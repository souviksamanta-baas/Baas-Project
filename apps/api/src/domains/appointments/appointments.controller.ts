import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

import {
  assertOrgMembership,
  assertUsersAreOrgMembers,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';
import { AppointmentsService } from './appointments.service';

class AppointmentInviteEmailDto {
  @IsUUID()
  appointmentId!: string;

  @IsUUID()
  organizationId!: string;

  @IsEmail()
  toEmail!: string;

  @IsOptional()
  @IsString()
  fromLabel?: string | null;
}

class AssigneeAvailabilityDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  businessCenterId!: string;

  @IsString()
  @MinLength(1)
  startsAt!: string;

  @IsString()
  @MinLength(1)
  endsAt!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth('SupabaseAuth')
  @ApiOperation({ summary: 'Send appointment invite email to the Para recipient' })
  @ApiOkResponse({ description: 'Invite email queued/sent.' })
  async inviteEmail(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: AppointmentInviteEmailDto,
  ): Promise<{ ok: true }> {
    let userId: string;
    try {
      const user = await resolveAuthUser(this.supabaseService, authorizationHeader);
      userId = user.id;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }

    await assertOrgMembership({
      organizationId: body.organizationId,
      supabaseService: this.supabaseService,
      userId,
    });

    const appointment = await this.appointmentsService.getAppointmentForOrg({
      appointmentId: body.appointmentId,
      organizationId: body.organizationId,
    });
    if (!appointment) {
      throw new NotFoundException('No se encontró el turno.');
    }

    try {
      await this.appointmentsService.sendInviteEmail({
        endsAt: appointment.endsAt,
        fromLabel: body.fromLabel ?? null,
        notes: appointment.notes,
        startsAt: appointment.startsAt,
        title: appointment.title,
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
    let userId: string;
    try {
      const user = await resolveAuthUser(this.supabaseService, authorizationHeader);
      userId = user.id;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }

    await assertOrgMembership({
      organizationId: body.organizationId,
      supabaseService: this.supabaseService,
      userId,
    });

    try {
      await assertUsersAreOrgMembers({
        organizationId: body.organizationId,
        supabaseService: this.supabaseService,
        userIds: body.userIds,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo validar a los asignados.',
      );
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
