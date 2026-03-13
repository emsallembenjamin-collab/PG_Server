import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency, CurrencyStatus } from './entities/currency.entity';
import { CurrencyRate } from './entities/currency-rate.entity';
import { ICurrencyPlugin } from './interfaces/currency-plugin.interface';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { UpsertCurrencyRateDto } from './dto/upsert-currency-rate.dto';

@Injectable()
export class CurrencyService {
  private plugins: Map<string, ICurrencyPlugin> = new Map();
  private currencyCache: Map<string, Currency> = new Map();
  private rateCache: Map<string, CurrencyRate> = new Map();

  constructor(
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
    @InjectRepository(CurrencyRate)
    private rateRepository: Repository<CurrencyRate>,
  ) {}

  /**
   * Register a currency plugin
   */
  registerPlugin(plugin: ICurrencyPlugin): void {
    this.plugins.set(plugin.getName(), plugin);
  }

  async findAll(): Promise<Currency[]> {
    return this.currencyRepository.find({
      order: { code: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Currency> {
    const currency = await this.currencyRepository.findOne({
      where: { id },
    });

    if (!currency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    return currency;
  }

  async create(createCurrencyDto: CreateCurrencyDto): Promise<Currency> {
    const currency = this.currencyRepository.create({
      ...createCurrencyDto,
      code: createCurrencyDto.code.trim().toUpperCase(),
      name: createCurrencyDto.name.trim(),
      symbol: createCurrencyDto.symbol?.trim() || null,
      config: createCurrencyDto.config?.trim() || null,
    });

    const saved = await this.currencyRepository.save(currency);
    await this.refreshCache();
    return saved;
  }

  async update(id: number, updateCurrencyDto: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.findOne(id);

    if (typeof updateCurrencyDto.code === 'string') {
      currency.code = updateCurrencyDto.code.trim().toUpperCase();
    }
    if (typeof updateCurrencyDto.name === 'string') {
      currency.name = updateCurrencyDto.name.trim();
    }
    if (updateCurrencyDto.symbol !== undefined) {
      currency.symbol = updateCurrencyDto.symbol?.trim() || null;
    }
    if (updateCurrencyDto.decimal_places !== undefined) {
      currency.decimal_places = updateCurrencyDto.decimal_places;
    }
    if (updateCurrencyDto.status) {
      currency.status = updateCurrencyDto.status;
    }
    if (updateCurrencyDto.config !== undefined) {
      currency.config = updateCurrencyDto.config?.trim() || null;
    }

    const saved = await this.currencyRepository.save(currency);
    await this.refreshCache();
    return saved;
  }

  async listRates(currencyId: number): Promise<CurrencyRate[]> {
    await this.findOne(currencyId);
    return this.rateRepository.find({
      where: { from_currency_id: currencyId },
      relations: ['from_currency', 'to_currency'],
      order: { updated_at: 'DESC' },
    });
  }

  async upsertRate(
    currencyId: number,
    upsertCurrencyRateDto: UpsertCurrencyRateDto,
  ): Promise<CurrencyRate> {
    await this.findOne(currencyId);
    await this.findOne(upsertCurrencyRateDto.to_currency_id);

    let rate = await this.rateRepository.findOne({
      where: {
        from_currency_id: currencyId,
        to_currency_id: upsertCurrencyRateDto.to_currency_id,
      },
      relations: ['from_currency', 'to_currency'],
    });

    if (rate) {
      rate.rate = upsertCurrencyRateDto.rate;
      rate.reverse_rate = upsertCurrencyRateDto.reverse_rate ?? null;
      rate.expires_at = upsertCurrencyRateDto.expires_at
        ? new Date(upsertCurrencyRateDto.expires_at)
        : null;
    } else {
      rate = this.rateRepository.create({
        from_currency_id: currencyId,
        to_currency_id: upsertCurrencyRateDto.to_currency_id,
        rate: upsertCurrencyRateDto.rate,
        reverse_rate: upsertCurrencyRateDto.reverse_rate ?? null,
        expires_at: upsertCurrencyRateDto.expires_at
          ? new Date(upsertCurrencyRateDto.expires_at)
          : null,
      });
    }

    const saved = await this.rateRepository.save(rate);
    this.rateCache.clear();
    return this.rateRepository.findOne({
      where: { id: saved.id },
      relations: ['from_currency', 'to_currency'],
    }) as Promise<CurrencyRate>;
  }

  /**
   * Get active plugin (defaults to 'default')
   */
  getPlugin(name: string = 'default'): ICurrencyPlugin {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new NotFoundException(`Currency plugin ${name} not found`);
    }
    return plugin;
  }

  /**
   * Get currency information
   */
  async getCurrency(code: string): Promise<Currency> {
    // Check cache first
    if (this.currencyCache.has(code)) {
      return this.currencyCache.get(code)!;
    }

    const currency = await this.currencyRepository.findOne({
      where: { code: code.toUpperCase(), status: CurrencyStatus.ACTIVE },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found or inactive`);
    }

    this.currencyCache.set(code.toUpperCase(), currency);
    return currency;
  }

  /**
   * Get currency info (synchronous, from cache)
   */
  getCurrencyInfo(code: string): Currency | null {
    return this.currencyCache.get(code.toUpperCase()) || null;
  }

  /**
   * Get exchange rate
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number | null> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const cacheKey = `${fromCurrency}_${toCurrency}`;
    if (this.rateCache.has(cacheKey)) {
      const rate = this.rateCache.get(cacheKey)!;
      // Check if expired
      if (rate.expires_at && new Date() > rate.expires_at) {
        this.rateCache.delete(cacheKey);
      } else {
        return Number(rate.rate);
      }
    }

    const rate = await this.rateRepository.findOne({
      where: {
        from_currency: { code: fromCurrency.toUpperCase() },
        to_currency: { code: toCurrency.toUpperCase() },
      },
      relations: ['from_currency', 'to_currency'],
    });

    if (rate) {
      this.rateCache.set(cacheKey, rate);
      return Number(rate.rate);
    }

    // Try reverse rate
    const reverseRate = await this.rateRepository.findOne({
      where: {
        from_currency: { code: toCurrency.toUpperCase() },
        to_currency: { code: fromCurrency.toUpperCase() },
      },
      relations: ['from_currency', 'to_currency'],
    });

    if (reverseRate && reverseRate.reverse_rate) {
      return 1 / Number(reverseRate.reverse_rate);
    }

    return null;
  }

  /**
   * Get all active currencies
   */
  getActiveCurrencies(): string[] {
    return Array.from(this.currencyCache.keys());
  }

  /**
   * Validate currency code
   */
  async validateCurrency(code: string): Promise<boolean> {
    try {
      await this.getCurrency(code);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert amount between currencies
   */
  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    const plugin = this.getPlugin();
    return plugin.convertAmount(amount, fromCurrency, toCurrency);
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currency: string): string {
    const plugin = this.getPlugin();
    return plugin.formatAmount(amount, currency);
  }

  /**
   * Refresh currency cache
   */
  async refreshCache(): Promise<void> {
    const currencies = await this.currencyRepository.find({
      where: { status: CurrencyStatus.ACTIVE },
    });

    this.currencyCache.clear();
    currencies.forEach((currency) => {
      this.currencyCache.set(currency.code, currency);
    });
  }
}
