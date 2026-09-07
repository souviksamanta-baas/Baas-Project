import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
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
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

import { AcceptOrganizationInviteDto, ErrorResponseDto } from '../../docs/openapi.dtos';
import {
  BusinessCentersService,
  type BusinessCenterDto,
} from './business-centers.service';
import {
  OrganizationInvitesService,
  type OrganizationInviteRole,
  type OrganizationInviteSummary,
} from './organization-invites.service';
import { OrganizationLifecycleService } from './organization-lifecycle.service';

class CreateBusinessCenterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

class UpdateBusinessCenterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

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
    private readonly businessCentersService: BusinessCentersService,
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

  @Get(':organizationId/business-centers')
  @ApiOperation({ summary: 'List business centers (sucursales) for an organization' })
  async listBusinessCenters(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
  ): Promise<BusinessCenterDto[]> {
    return this.businessCentersService.listCenters({
      authorizationHeader,
      organizationId,
    });
  }

  @Post(':organizationId/business-centers')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a business center (requires multi_sucursales)' })
  async createBusinessCenter(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateBusinessCenterDto,
  ): Promise<BusinessCenterDto> {
    return this.businessCentersService.createCenter({
      authorizationHeader,
      name: body.name,
      organizationId,
      timezone: body.timezone,
    });
  }

  @Patch(':organizationId/business-centers/:businessCenterId')
  @ApiOperation({ summary: 'Update a business center' })
  async updateBusinessCenter(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
    @Param('businessCenterId') businessCenterId: string,
    @Body() body: UpdateBusinessCenterDto,
  ): Promise<BusinessCenterDto> {
    return this.businessCentersService.updateCenter({
      authorizationHeader,
      businessCenterId,
      isActive: body.isActive,
      name: body.name,
      organizationId,
      timezone: body.timezone,
    });
  }

  @Post(':organizationId/business-centers/:businessCenterId/set-default')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a business center as the organization default' })
  async setDefaultBusinessCenter(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
    @Param('businessCenterId') businessCenterId: string,
  ): Promise<BusinessCenterDto> {
    return this.businessCentersService.setDefaultCenter({
      authorizationHeader,
      businessCenterId,
      organizationId,
    });
  }

  @Get(':organizationId/members')
  @ApiOperation({ summary: 'List organization members' })
  async listMembers(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('organizationId') organizationId: string,
  ): Promise<
    Array<{
      displayName: string;
      email: string | null;
      phoneE164: string | null;
      role: string;
      userId: string;
    }>
  > {
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
