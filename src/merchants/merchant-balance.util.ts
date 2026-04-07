import { Merchant } from './entities/merchant.entity';
import { MerchantBalance } from './entities/merchant-balance.entity';
import { Currency } from '../currencies/entities/currency.entity';

export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type MerchantBalanceView = {
  currency: string;
  balance_available: number;
  balance_locked: number;
  balance_total: number;
};

function normalizeBalanceRows(
  balances: (MerchantBalance & { currency?: Currency })[] | undefined,
): MerchantBalanceView[] {
  const rows = balances ?? [];
  return rows
    .map((b) => {
      const currency = (b.currency?.code || 'USD').trim().toUpperCase();
      const available = roundMoney(parseMoney(b.balance_available));
      const locked = roundMoney(parseMoney(b.balance_locked));
      return {
        currency,
        balance_available: available,
        balance_locked: locked,
        balance_total: roundMoney(available + locked),
      };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Flat fields mirror the primary row (USD if present, else first by currency code) for backward compatibility. */
export function serializeMerchantBalances(
  merchant: Merchant & {
    balances?: (MerchantBalance & { currency?: Currency })[];
  },
) {
  const balances = normalizeBalanceRows(merchant.balances);
  const primary = balances.find((x) => x.currency === 'USD') ?? balances[0];
  return {
    balances,
    balance_currency: primary?.currency ?? 'USD',
    balance_available: primary?.balance_available ?? 0,
    balance_locked: primary?.balance_locked ?? 0,
    balance_total: primary?.balance_total ?? 0,
  };
}
