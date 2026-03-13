import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CurrencyRate } from './currency-rate.entity';

export enum CurrencyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('currencies')
export class Currency {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 3, unique: true })
  code: string; // ISO 4217 code (USD, EUR, VND, etc.)

  @Column({ type: 'varchar', length: 100 })
  name: string; // Full name (US Dollar, Vietnamese Dong, etc.)

  @Column({ type: 'varchar', length: 10, nullable: true })
  symbol: string; // $, €, ₫, etc.

  @Column({ type: 'int', default: 2 })
  decimal_places: number; // Number of decimal places (2 for USD, 0 for VND)

  @Column({
    type: 'enum',
    enum: CurrencyStatus,
    default: CurrencyStatus.ACTIVE,
  })
  status: CurrencyStatus;

  @Column({ type: 'text', nullable: true })
  config: string; // JSON string for currency-specific config (formatting, etc.)

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CurrencyRate, (rate) => rate.from_currency)
  rates_from: CurrencyRate[];

  @OneToMany(() => CurrencyRate, (rate) => rate.to_currency)
  rates_to: CurrencyRate[];
}
