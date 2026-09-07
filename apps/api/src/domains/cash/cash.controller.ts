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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

import { CashService } from './cash.service';
import type { CashEntrySource, CashEntryType } from './cash.types';

class OrgCenterDateQuery {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  businessCenterId!: string;

  @IsString()
  @MinLength(1)
  entryDate!: string;
}

class OrgCenterRangeQuery {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  businessCenterId!: string;

  @IsString()
  @MinLength(1)
  fromDate!: string;

  @IsString()
  @MinLength(1)
  toDate!: string;
}

class CreateManualEntryDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  businessCenterId!: string;

  @IsString()
  @MinLength(1)
  entryDate!: string;

  @IsIn(['ingreso', 'egreso'])
  entryType!: CashEntryType;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @MinLength(1)
  concept!: string;
}

class UpdateManualEntryDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  entryDate?: string;

  @IsOptional()
  @IsIn(['ingreso', 'egreso'])
  entryType?: CashEntryType;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  concept?: string;
}

class UpsertAutoEntryDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  businessCenterId!: string;

  @IsString()
  @MinLength(1)
  entryDate!: string;

  @IsIn(['ingreso', 'egreso'])
  entryType!: CashEntryType;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  concept!: string;

  @IsIn(['venta', 'compra', 'stock'])
  source!: Exclude<CashEntrySource, 'manual'>;

  @IsString()
  @MinLength(1)
  sourceId!: string;
}

class DeleteAutoEntryDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  businessCenterId!: string;

  @IsIn(['venta', 'compra', 'stock'])
  source!: Exclude<CashEntrySource, 'manual'>;

  @IsString()
  @MinLength(1)
  sourceId!: string;
}

@ApiTags('Cash')
@ApiBearerAuth('SupabaseAuth')
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('day')
  @ApiOperation({ summary: 'Get cash ledger day balances and movements' })
  @ApiOkResponse({ description: 'Day balances with entries' })
  async getDay(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: OrgCenterDateQuery,
  ) {
    return this.cashService.getDayBalances({
      authorizationHeader,
      businessCenterId: query.businessCenterId,
      entryDate: query.entryDate,
      organizationId: query.organizationId,
    });
  }

  @Get('report')
  @ApiOperation({ summary: 'Get cash ledger range report (Reportes Balances)' })
  @ApiOkResponse({ description: 'Range summary with daily breakdown' })
  async getReport(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: OrgCenterRangeQuery,
  ) {
    return this.cashService.getRangeReport({
      authorizationHeader,
      businessCenterId: query.businessCenterId,
      fromDate: query.fromDate,
      organizationId: query.organizationId,
      toDate: query.toDate,
    });
  }

  @Post('entries')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a manual ingreso/egreso' })
  async createManual(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CreateManualEntryDto,
  ) {
    return this.cashService.createManualEntry({
      amountCents: body.amountCents,
      authorizationHeader,
      businessCenterId: body.businessCenterId,
      concept: body.concept,
      entryDate: body.entryDate,
      entryType: body.entryType,
      organizationId: body.organizationId,
    });
  }

  @Patch('entries/:entryId')
  @ApiOperation({ summary: 'Update a manual cash movement' })
  async updateManual(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('entryId') entryId: string,
    @Body() body: UpdateManualEntryDto,
  ) {
    return this.cashService.updateManualEntry({
      amountCents: body.amountCents,
      authorizationHeader,
      concept: body.concept,
      entryDate: body.entryDate,
      entryId,
      entryType: body.entryType,
      organizationId: body.organizationId,
    });
  }

  @Delete('entries/:entryId')
  @ApiOperation({ summary: 'Delete a manual cash movement' })
  async deleteManual(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('entryId') entryId: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.cashService.deleteManualEntry({
      authorizationHeader,
      entryId,
      organizationId,
    });
  }

  @Post('entries/auto')
  @HttpCode(200)
  @ApiOperation({ summary: 'Upsert an automatic cash posting (venta/compra/stock)' })
  async upsertAuto(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: UpsertAutoEntryDto,
  ) {
    return this.cashService.upsertAutoEntry({
      amountCents: body.amountCents,
      authorizationHeader,
      businessCenterId: body.businessCenterId,
      concept: body.concept,
      entryDate: body.entryDate,
      entryType: body.entryType,
      organizationId: body.organizationId,
      source: body.source,
      sourceId: body.sourceId,
    });
  }

  @Post('entries/auto/delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an automatic cash posting by source key' })
  async deleteAuto(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: DeleteAutoEntryDto,
  ) {
    return this.cashService.deleteAutoEntry({
      authorizationHeader,
      businessCenterId: body.businessCenterId,
      organizationId: body.organizationId,
      source: body.source,
      sourceId: body.sourceId,
    });
  }
}
