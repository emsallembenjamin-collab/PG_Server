import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { MerchantApiKey } from './merchant-api-key.entity';
import { MerchantConfig } from './merchant-config.entity';
import { Provider } from '../../providers/entities/provider.entity';

export enum MerchantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({
    type: 'enum',
    enum: MerchantStatus,
    default: MerchantStatus.ACTIVE,
  })
  status: MerchantStatus;

  @Column({ type: 'text', nullable: true })
  webhook_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  webhook_secret: string;

  @Column({ type: 'simple-json', nullable: true })
  whitelisted_ips: string[];

  @Column({ nullable: true })
  provider_id: number; // Assigned provider (one per merchant)

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  username: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  /** Ledger currency (ISO 4217). Withdrawals must match; deposits credit only when currency matches. */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  balance_currency: string;

  /** Spendable balance (deposits succeed here; withdrawals reserve from here into locked). */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance_available: string;

  /** Amount reserved for in-flight withdrawals until settled or released. */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance_locked: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Transaction, (transaction) => transaction.merchant)
  transactions: Transaction[];

  @OneToMany(() => MerchantApiKey, (apiKey) => apiKey.merchant)
  api_keys: MerchantApiKey[];

  @OneToMany(() => MerchantConfig, (config) => config.merchant)
  configs: MerchantConfig[];

  @ManyToOne(() => Provider, { nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;
}
