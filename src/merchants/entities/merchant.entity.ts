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

  @Column({ nullable: true })
  provider_id: number; // Assigned provider (one per merchant)

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
