import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BanksService } from './banks.service';

@ApiTags('Banks (reference)')
@Controller('banks')
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Get('vietnam-codes')
  @ApiOperation({
    summary: 'List Vietnam bank codes (BIN-style) for payout reference',
    description:
      'Static reference table: bank code, full name, abbreviation. Does not replace DPay `bank_list` for live channel codes.',
  })
  async listVietnamCodes() {
    const rows = await this.banksService.findAllVietnamCodes();
    return {
      data: rows.map((r) => ({
        code: r.code,
        full_name: r.full_name,
        abbreviation: r.abbreviation,
      })),
    };
  }
}
