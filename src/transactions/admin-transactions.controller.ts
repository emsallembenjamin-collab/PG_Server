import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionStatus } from './entities/transaction.entity';
import {
  ForceSandboxOutcomeDto,
  ReplaySandboxCallbackDto,
} from './dto/sandbox-transaction-action.dto';

@ApiTags('Admin - Transactions')
@Controller('admin/transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminTransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all transactions (admin)' })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('merchantId') merchantId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: TransactionStatus,
    @Query('type') type?: 'deposit' | 'withdrawal',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sandbox') sandbox?: string,
  ) {
    return this.transactionsService.findAllForAdmin(
      +page,
      +limit,
      {
        merchantId: merchantId ? +merchantId : undefined,
        providerId: providerId ? +providerId : undefined,
        status,
        type,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        sandbox:
          sandbox === 'true' ? true : sandbox === 'false' ? false : undefined,
      },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID (admin)' })
  async findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(+id);
  }

  @Post(':id/sandbox/force-outcome')
  @ApiOperation({ summary: 'Force a sandbox transaction status (admin)' })
  async forceOutcome(
    @Param('id') id: string,
    @Body() dto: ForceSandboxOutcomeDto,
  ) {
    return this.transactionsService.forceSandboxStatus(
      +id,
      dto.status,
      dto.failureReason,
    );
  }

  @Post(':id/sandbox/replay-callback')
  @ApiOperation({ summary: 'Replay a sandbox provider callback (admin)' })
  async replayCallback(
    @Param('id') id: string,
    @Body() dto: ReplaySandboxCallbackDto,
  ) {
    return this.transactionsService.replaySandboxCallback(
      +id,
      dto.status,
      dto.message,
    );
  }
}
