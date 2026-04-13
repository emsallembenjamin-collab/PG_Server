import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationType, ReconciliationStatus } from './entities/reconciliation.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Reconciliation (Admin)')
@Controller('admin/reconciliation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post('merchant/:merchantId')
  @ApiOperation({ summary: 'Run reconciliation for a merchant' })
  async reconcileMerchant(
    @Param('merchantId') merchantId: string,
    @Body() body: { startDate: string; endDate: string },
  ) {
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    return this.reconciliationService.reconcileMerchant(
      +merchantId,
      startDate,
      endDate,
    );
  }

  @Post('provider/:providerId')
  @ApiOperation({ summary: 'Run reconciliation for a provider' })
  async reconcileProvider(
    @Param('providerId') providerId: string,
    @Body() body: { startDate: string; endDate: string },
  ) {
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    return this.reconciliationService.reconcileProvider(
      +providerId,
      startDate,
      endDate,
    );
  }

  @Post('daily')
  @ApiOperation({ summary: 'Run daily reconciliation for all merchants and providers' })
  async reconcileDaily(@Body() body: { date: string }) {
    const date = new Date(body.date);
    return this.reconciliationService.reconcileDaily(date);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reconciliations with filters' })
  async findAll(
    @Query('type') type?: ReconciliationType,
    @Query('status') status?: ReconciliationStatus,
    @Query('merchantId') merchantId?: string,
    @Query('providerId') providerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reconciliationService.findAll({
      type,
      status,
      merchantId: merchantId ? +merchantId : undefined,
      providerId: providerId ? +providerId : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reconciliation by ID' })
  async findOne(@Param('id') id: string) {
    return this.reconciliationService.findOne(+id);
  }

  @Post('discrepancies/:id/resolve')
  @ApiOperation({ summary: 'Resolve a discrepancy' })
  async resolveDiscrepancy(
    @Param('id') id: string,
    @Body() body: { resolutionNotes: string; resolvedBy: number },
  ) {
    return this.reconciliationService.resolveDiscrepancy(
      +id,
      body.resolutionNotes,
      body.resolvedBy,
    );
  }

  @Post('discrepancies/:id/replay-callback')
  @ApiOperation({ summary: 'Replay merchant callback for discrepancy transaction' })
  async replayCallbackForDiscrepancy(@Param('id') id: string) {
    return this.reconciliationService.replayMerchantCallbackForDiscrepancy(+id);
  }
}
