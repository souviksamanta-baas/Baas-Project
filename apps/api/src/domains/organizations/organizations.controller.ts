import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
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

import { AcceptOrganizationInviteDto, ErrorResponseDto } from '../../docs/openapi.dtos';
import {
  OrganizationInvitesService,
  type OrganizationInviteRole,
  type OrganizationInviteSummary,
} from './organization-invites.service';
import { OrganizationLifecycleService } from './organization-lifecycle.service';

interface CreateInviteBody {
  businessCenterId?: string;
  businessCenterIds?: string[];
  invitedDisplayName?: string;
  invitedPhoneE164: string;
  organizationId: string;
  role: OrganizationInviteRole;
}

@ApiTags('Organizations')
@ApiBearerAuth('SupabaseAuth')
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly invitesService: OrganizationInvitesService,
    private readonly lifecycleService: OrganizationLifecycleService,
  ) {}

  @Post('invites')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a staff invite QR token' })
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
        businessCenterIds: body.businessCenterIds,
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
  @ApiBody({ type: AcceptOrganizationInviteDto })
  @ApiOkResponse({ description: 'Invite accepted.' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async acceptInvite(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: AcceptOrganizationInviteDto,
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

  @Post('account/delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete the authenticated auth user and sole-owned orgs' })
  async deleteAccount(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: { confirmation: string },
  ): Promise<{ deleted: true }> {
    return this.lifecycleService.deleteAccount({
      authorizationHeader,
      confirmation: body.confirmation ?? '',
    });
  }

  @Get(':organizationId/members')
  @ApiOperation({ summary: 'List organization members' })
  async listMembers(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
  ): Promise<Array<{ role: string; userId: string }>> {
    return this.lifecycleService.listMembers({ authorizationHeader, organizationId });
  }

  @Post(':organizationId/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive (soft-deactivate) an organization' })
  async archiveOrganization(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: { confirmation: string },
  ): Promise<{ archivedAt: string }> {
    return this.lifecycleService.archiveOrganization({
      authorizationHeader,
      confirmation: body.confirmation ?? '',
      organizationId,
    });
  }

  @Delete(':organizationId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hard-delete an organization and cascaded tenant data' })
  async deleteOrganization(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: { confirmation: string },
  ): Promise<{ deleted: true }> {
    return this.lifecycleService.deleteOrganization({
      authorizationHeader,
      confirmation: body.confirmation ?? '',
      organizationId,
    });
  }

  @Post(':organizationId/leave')
  @HttpCode(200)
  @ApiOperation({ summary: 'Leave an organization (staff, or owner with co-owner)' })
  async leaveOrganization(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
  ): Promise<{ left: true }> {
    return this.lifecycleService.leaveOrganization({ authorizationHeader, organizationId });
  }

  @Post(':organizationId/transfer-ownership')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transfer ownership to another member' })
  async transferOwnership(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: { newOwnerUserId: string },
  ): Promise<{ transferred: true }> {
    return this.lifecycleService.transferOwnership({
      authorizationHeader,
      newOwnerUserId: body.newOwnerUserId,
      organizationId,
    });
  }

  @Post(':organizationId/members/remove')
  @HttpCode(200)
  @ApiOperation({ summary: 'Owner removes a staff member' })
  async removeMember(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: { userId: string },
  ): Promise<{ removed: true }> {
    return this.lifecycleService.removeMember({
      authorizationHeader,
      organizationId,
      userId: body.userId,
    });
  }

  @Get(':organizationId/export')
  @ApiOperation({ summary: 'GDPR-style organization data export (owner)' })
  async exportOrganization(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
  ): Promise<Record<string, unknown>> {
    return this.lifecycleService.exportOrganizationData({ authorizationHeader, organizationId });
  }

}
