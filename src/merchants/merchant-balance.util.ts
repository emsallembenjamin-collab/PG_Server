import { Merchant } from './entities/merchant.entity';

export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function merchantBalanceCurrency(merchant: Merchant): string {
  return (merchant.balance_currency || 'USD').trim().toUpperCase();
}

export function serializeMerchantBalances(merchant: Merchant) {
  const available = roundMoney(parseMoney(merchant.balance_available));
  const locked = roundMoney(parseMoney(merchant.balance_locked));
  return {
    balance_currency: merchantBalanceCurrency(merchant),
    balance_available: available,
    balance_locked: locked,
    balance_total: roundMoney(available + locked),
  };
}
