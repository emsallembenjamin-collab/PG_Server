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
import { Reconciliation } from './reconciliation.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

export enum DiscrepancyType {
  AMOUNT_MISMATCH = 'amount_mismatch',
  STATUS_MISMATCH = 'status_mismatch',
  MISSING_TRANSACTION = 'missing_transaction',
  DUPLICATE_TRANSACTION = 'duplicate_transaction',
  FEE_MISMATCH = 'fee_mismatch',
  CURRENCY_MISMATCH = 'currency_mismatch',
}

export enum DiscrepancyStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

@Entity('reconciliation_discrepancies')
@Index(['reconciliation_id', 'status'])
export class ReconciliationDiscrepancy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  reconciliation_id: number;

  @Column({ nullable: true })
  transaction_id: number;

  @Column({ type: 'enum', enum: DiscrepancyType })
  type: DiscrepancyType;

  @Column({
    type: 'enum',
    enum: DiscrepancyStatus,
    default: DiscrepancyStatus.OPEN,
  })
  status: DiscrepancyStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  expected_value: string; // JSON string

  @Column({ type: 'text', nullable: true })
  actual_value: string; // JSON string

  @Column({ type: 'text', nullable: true })
  resolution_notes: string;

  @Column({ type: 'datetime', nullable: true })
  resolved_at: Date;

  @Column({ nullable: true })
  resolved_by: number; // Admin user ID

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Reconciliation, (reconciliation) => reconciliation.discrepancies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reconciliation_id' })
  reconciliation: Reconciliation;

  @ManyToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;
}
