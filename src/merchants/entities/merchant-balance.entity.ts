import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Merchant } from './merchant.entity';
import { Currency } from '../../currencies/entities/currency.entity';

@Entity('merchant_balances')
/**
 * Explicit names must match DB so `synchronize` does not emit `DROP INDEX` on indexes that
 * InnoDB also uses for foreign keys (MySQL then errors: "needed in a foreign key constraint").
 */
@Index('IDX_merchant_balances_merchant_id', ['merchant_id'])
@Index('IDX_merchant_balances_currency_id', ['currency_id'])
@Index('UQ_merchant_bal_merchant_currency', ['merchant_id', 'currency_id'], {
  unique: true,
})
export class MerchantBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  merchant_id: number;

  @ManyToOne(() => Merchant, (m) => m.balances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  /** FK to `currencies.id` (not ISO code — use `currency` relation for `code`). */
  @Column()
  currency_id: number;

  @ManyToOne(() => Currency, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currency_id' })
  currency: Currency;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance_available: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance_locked: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
