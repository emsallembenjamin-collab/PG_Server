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
import { Currency } from './currency.entity';

@Entity('currency_rates')
@Index(['from_currency_id', 'to_currency_id'], { unique: true })
export class CurrencyRate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  from_currency_id: number;

  @Column()
  to_currency_id: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  rate: number; // Exchange rate from -> to

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  reverse_rate: number; // Cached reverse rate (to -> from)

  @Column({ type: 'datetime', nullable: true })
  expires_at: Date; // Rate expiration (null = manual rate)

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Currency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_currency_id' })
  from_currency: Currency;

  @ManyToOne(() => Currency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_currency_id' })
  to_currency: Currency;
}
