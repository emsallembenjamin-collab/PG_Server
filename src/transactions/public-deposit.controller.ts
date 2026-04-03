import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TransactionsService } from './transactions.service';

@ApiTags('Public')
@Controller('public')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class PublicDepositController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('deposit/:token')
  @ApiOperation({
    summary: 'Get deposit payment instructions (public)',
    description:
      'Returns the same payment payload as the merchant API for this deposit, keyed by `public_code` (preferred) or legacy `public_token` from the create-deposit response. No API key.',
  })
  getDepositInstructions(@Param('token') token: string) {
    return this.transactionsService.getPublicDepositInstructions(token);
  }
}
