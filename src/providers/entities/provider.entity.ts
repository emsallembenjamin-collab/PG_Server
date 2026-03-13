import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProviderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string; // e.g., 'goldpay', 'stripe', 'paypal'

  @Column({ type: 'varchar', length: 255 })
  display_name: string;

  @Column({
    type: 'enum',
    enum: ProviderStatus,
    default: ProviderStatus.ACTIVE,
  })
  status: ProviderStatus;

  @Column({ type: 'int', default: 100 })
  priority: number; // Lower number = higher priority

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  fee_percentage: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  min_amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  max_amount: number;

  @Column({ type: 'text', nullable: true })
  config: string; // JSON string for provider-specific config

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
