import { Injectable } from '@nestjs/common';
import { IMerchantConfigPlugin } from '../interfaces/merchant-config-plugin.interface';

/**
 * Default Merchant Config Plugin
 * Handles standard merchant configuration keys
 */
@Injectable()
export class DefaultMerchantConfigPlugin implements IMerchantConfigPlugin {
  getName(): string {
    return 'default';
  }

  getSupportedKeys(): string[] {
    return [
      'allowed_currencies',
      'default_currency',
      'fee_structure',
      'webhook_retry_count',
      'webhook_timeout',
      'max_transaction_amount',
      'min_transaction_amount',
      'allowed_providers',
      'auto_settlement',
      'settlement_schedule',
    ];
  }

  validateConfig(key: string, value: any): boolean {
    switch (key) {
      case 'allowed_currencies':
        return Array.isArray(value) && value.every((c) => typeof c === 'string');
      case 'default_currency':
        return typeof value === 'string' && value.length === 3;
      case 'fee_structure':
        return (
          typeof value === 'object' &&
          (value.type === 'percentage' || value.type === 'fixed') &&
          typeof value.value === 'number'
        );
      case 'webhook_retry_count':
        return typeof value === 'number' && value >= 0 && value <= 10;
      case 'webhook_timeout':
        return typeof value === 'number' && value > 0 && value <= 30000;
      case 'max_transaction_amount':
      case 'min_transaction_amount':
        return typeof value === 'number' && value > 0;
      case 'allowed_providers':
        return Array.isArray(value) && value.every((p) => typeof p === 'string');
      case 'auto_settlement':
        return typeof value === 'boolean';
      case 'settlement_schedule':
        return typeof value === 'string'; // cron expression
      default:
        return true; // Unknown keys pass validation
    }
  }

  getDefaults(): Record<string, any> {
    return {
      allowed_currencies: ['USD', 'EUR', 'VND'],
      default_currency: 'USD',
      fee_structure: { type: 'percentage', value: 0 },
      webhook_retry_count: 3,
      webhook_timeout: 10000,
      max_transaction_amount: 1000000,
      min_transaction_amount: 0.01,
      allowed_providers: [],
      auto_settlement: false,
      settlement_schedule: '0 0 * * *', // Daily at midnight
    };
  }
}
