import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ArcaConnectionSummaryDto,
  ArcaMarkConnectedDto,
  ArcaUpsertConnectionDto,
} from '../../docs/openapi.dtos';
import { ArcaConnectionService } from './arca-connection.service';
import type { ArcaConnectionSummary, TaxCondition } from './arca.types';

@ApiTags('ARCA')
@ApiBearerAuth('SupabaseAuth')
@Controller('arca')
export class ArcaController {
  constructor(private readonly connectionService: ArcaConnectionService) {}

  @Get('connection')
  @ApiOperation({ summary: 'Get ARCA connection status for an organization' })
  @ApiOkResponse({ type: ArcaConnectionSummaryDto })
  async getConnection(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('organizationId') organizationId: string,
  ): Promise<ArcaConnectionSummary> {
    return this.connectionService.getConnection({
      authorizationHeader,
      organizationId,
    });
  }

  @Post('connection')
  @HttpCode(200)
  @ApiOperation({ summary: 'Configure ARCA CUIT, tax condition and punto de venta (owner)' })
  @ApiOkResponse({ type: ArcaConnectionSummaryDto })
  async upsertConnection(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: ArcaUpsertConnectionDto,
  ): Promise<ArcaConnectionSummary> {
    return this.connectionService.upsertConnection({
      authorizationHeader,
      certificatePem: body.certificatePem,
      cuit: body.cuit,
      environment: body.environment,
      organizationId: body.organizationId,
      pointOfSale: body.pointOfSale,
      privateKeyPem: body.privateKeyPem,
      taxCondition: body.taxCondition as TaxCondition,
    });
  }

  @Post('connection/confirm-delegation')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark ARCA as connected after merchant authorized Nexolia in Administrador de Relaciones',
  })
  @ApiOkResponse({ type: ArcaConnectionSummaryDto })
  async confirmDelegation(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: ArcaMarkConnectedDto,
  ): Promise<ArcaConnectionSummary> {
    return this.connectionService.markConnected({
      authorizationHeader,
      organizationId: body.organizationId,
    });
  }
}
