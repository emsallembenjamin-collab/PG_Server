import { Injectable } from '@nestjs/common';
import { ICurrencyPlugin } from '../interfaces/currency-plugin.interface';
import { CurrencyService } from '../currencies.service';

/**
 * Default Currency Plugin
 * Uses database-stored currencies and exchange rates
 */
@Injectable()
export class DefaultCurrencyPlugin implements ICurrencyPlugin {
  constructor(private currencyService: CurrencyService) {}

  getName(): string {
    return 'default';
  }

  validateCurrency(code: string): boolean {
    // Basic validation - 3 uppercase letters
    return /^[A-Z]{3}$/.test(code);
  }

  formatAmount(amount: number, currency: string): string {
    const currencyInfo = this.currencyService.getCurrencyInfo(currency);
    if (!currencyInfo) {
      return amount.toFixed(2);
    }

    const decimals = currencyInfo.decimal_places || 2;
    const symbol = currencyInfo.symbol || currency;
    return `${symbol}${amount.toFixed(decimals)}`;
  }

  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    if (!rate) {
      throw new Error(
        `Exchange rate not found for ${fromCurrency} to ${toCurrency}`,
      );
    }

    return amount * rate;
  }

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number | null> {
    return this.currencyService.getExchangeRate(fromCurrency, toCurrency);
  }

  getSupportedCurrencies(): string[] {
    return this.currencyService.getActiveCurrencies();
  }
}
