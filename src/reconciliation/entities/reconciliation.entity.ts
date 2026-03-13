import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Provider } from '../../providers/entities/provider.entity';
import { ReconciliationDiscrepancy } from './reconciliation-discrepancy.entity';

export enum ReconciliationType {
  MERCHANT = 'merchant',
  PROVIDER = 'provider',
  DAILY = 'daily',
  SETTLEMENT = 'settlement',
}

export enum ReconciliationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DISCREPANCY = 'discrepancy',
}

@Entity('reconciliations')
@Index(['merchant_id', 'reconciliation_date'])
@Index(['provider_id', 'reconciliation_date'])
export class Reconciliation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ReconciliationType })
  type: ReconciliationType;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.PENDING,
  })
  status: ReconciliationStatus;

  @Column({ type: 'date' })
  reconciliation_date: Date;

  @Column({ nullable: true })
  merchant_id: number;

  @Column({ nullable: true })
  provider_id: number;

  // Summary statistics
  @Column({ type: 'int', default: 0 })
  total_transactions: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_amount: number;

  @Column({ type: 'int', default: 0 })
  succeeded_count: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  succeeded_amount: number;

  @Column({ type: 'int', default: 0 })
  failed_count: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  failed_amount: number;

  @Column({ type: 'int', default: 0 })
  pending_count: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  pending_amount: number;

  @Column({ type: 'int', default: 0 })
  discrepancy_count: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  metadata: string; // JSON string for additional data

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Merchant, { nullable: true })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ManyToOne(() => Provider, { nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @OneToMany(
    () => ReconciliationDiscrepancy,
    (discrepancy) => discrepancy.reconciliation,
  )
  discrepancies: ReconciliationDiscrepancy[];
}
