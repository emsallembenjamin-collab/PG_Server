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

@Entity('merchant_configs')
@Index(['merchant_id', 'key'], { unique: true })
export class MerchantConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  merchant_id: number;

  @Column({ type: 'varchar', length: 100 })
  key: string; // Config key (e.g., 'allowed_currencies', 'fee_structure', 'webhook_retry_count')

  @Column({ type: 'text' })
  value: string; // JSON string or plain value

  @Column({ type: 'varchar', length: 50, nullable: true })
  plugin_name: string; // Plugin that handles this config (null = default)

  @Column({ type: 'text', nullable: true })
  metadata: string; // Additional metadata (JSON)

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Merchant, (merchant) => merchant.configs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;
}
