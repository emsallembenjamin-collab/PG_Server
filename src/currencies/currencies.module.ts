import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyService } from './currencies.service';
import { CurrenciesController } from './currencies.controller';
import { Currency } from './entities/currency.entity';
import { CurrencyRate } from './entities/currency-rate.entity';
import { DefaultCurrencyPlugin } from './plugins/default-currency.plugin';

@Global() // Make available to all modules
@Module({
  imports: [TypeOrmModule.forFeature([Currency, CurrencyRate])],
  controllers: [CurrenciesController],
  providers: [CurrencyService, DefaultCurrencyPlugin],
  exports: [CurrencyService],
})
export class CurrenciesModule {
  constructor(
    private currencyService: CurrencyService,
    private defaultPlugin: DefaultCurrencyPlugin,
  ) {
    // Register default plugin on module initialization
    this.currencyService.registerPlugin(this.defaultPlugin);
  }
}
