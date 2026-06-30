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
  OrganizationInvitesService,
  type OrganizationInviteRole,
  type OrganizationInviteSummary,
} from './organization-invites.service';

interface CreateInviteBody {
  businessCenterId?: string;
  invitedDisplayName?: string;
  invitedPhoneE164: string;
  organizationId: string;
  role: OrganizationInviteRole;
}

interface AcceptInviteBody {
  inviteToken: string;
  verifiedPhoneE164: string;
}

@ApiTags('Organizations')
@ApiBearerAuth('SupabaseAuth')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly invitesService: OrganizationInvitesService) {}

  @Post('invites')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a staff invite QR token' })
  @ApiBody({
    schema: {
      properties: {
        businessCenterId: { type: 'string' },
        invitedDisplayName: { type: 'string' },
        invitedPhoneE164: { example: '+5491112345678', type: 'string' },
        organizationId: { type: 'string' },
        role: { enum: ['employee', 'manager', 'co_owner'], type: 'string' },
      },
      required: ['invitedPhoneE164', 'organizationId', 'role'],
      type: 'object',
    },
  })
  @ApiOkResponse({ description: 'Invite created.' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async createInvite(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CreateInviteBody,
  ): Promise<OrganizationInviteSummary> {
    try {
      return await this.invitesService.createInvite({
        authorizationHeader,
        businessCenterId: body.businessCenterId,
        invitedDisplayName: body.invitedDisplayName,
        invitedPhoneE164: body.invitedPhoneE164,
        organizationId: body.organizationId,
        role: body.role,
      });
    } catch (error) {
      if (error instanceof Error && /token|owner/i.test(error.message)) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }

  @Post('invites/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept a staff invite after phone verification' })
  @ApiBody({
    schema: {
      properties: {
        inviteToken: { type: 'string' },
        verifiedPhoneE164: { example: '+5491112345678', type: 'string' },
      },
      required: ['inviteToken', 'verifiedPhoneE164'],
      type: 'object',
    },
  })
  @ApiOkResponse({ description: 'Invite accepted.' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async acceptInvite(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: AcceptInviteBody,
  ): Promise<{ organizationId: string }> {
    try {
      return await this.invitesService.acceptInvite({
        authorizationHeader,
        inviteToken: body.inviteToken,
        verifiedPhoneE164: body.verifiedPhoneE164,
      });
    } catch (error) {
      if (error instanceof Error && /token|invitación|número/i.test(error.message)) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }
}
