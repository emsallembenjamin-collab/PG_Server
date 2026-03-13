import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrencyService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { UpsertCurrencyRateDto } from './dto/upsert-currency-rate.dto';

@ApiTags('Currencies')
@Controller('currencies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrencyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all currencies' })
  async findAll() {
    return this.currenciesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create currency' })
  async create(@Body() createCurrencyDto: CreateCurrencyDto) {
    return this.currenciesService.create(createCurrencyDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get currency by ID' })
  async findOne(@Param('id') id: string) {
    return this.currenciesService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update currency by ID' })
  async update(
    @Param('id') id: string,
    @Body() updateCurrencyDto: UpdateCurrencyDto,
  ) {
    return this.currenciesService.update(+id, updateCurrencyDto);
  }

  @Get(':id/rates')
  @ApiOperation({ summary: 'List outgoing currency rates for a currency' })
  async listRates(@Param('id') id: string) {
    return this.currenciesService.listRates(+id);
  }

  @Post(':id/rates')
  @ApiOperation({ summary: 'Create or update outgoing currency rate' })
  async upsertRate(
    @Param('id') id: string,
    @Body() upsertCurrencyRateDto: UpsertCurrencyRateDto,
  ) {
    return this.currenciesService.upsertRate(+id, upsertCurrencyRateDto);
  }
}
