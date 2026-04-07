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

@Entity('merchant_balances')
@Index('UQ_merchant_bal_merchant_currency', ['merchant_id', 'currency'], {
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

  /** ISO 4217, stored uppercase. */
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance_available: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance_locked: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
