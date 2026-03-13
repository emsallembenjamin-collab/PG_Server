/**
 * Currency Plugin Interface
 * Implement this interface to create custom currency handlers
 */
export interface ICurrencyPlugin {
  /**
   * Get plugin name
   */
  getName(): string;

  /**
   * Validate currency code
   */
  validateCurrency(code: string): boolean;

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currency: string): string;

  /**
   * Convert amount from one currency to another
   */
  convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number>;

  /**
   * Get exchange rate
   */
  getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number | null>;

  /**
   * Update exchange rates (for automatic rate providers)
   */
  updateExchangeRates?(): Promise<void>;

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): string[];
}
