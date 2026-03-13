import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Provider } from '../../providers/entities/provider.entity';
import { TransactionAttempt } from './transaction-attempt.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  merchant_id: number;

  @Column({ nullable: true })
  provider_id: number;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_id: string; // Provider's transaction ID

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference_id: string; // Merchant's reference ID

  @Column({ type: 'text', nullable: true })
  metadata: string; // JSON string for additional data

  @Column({ type: 'text', nullable: true })
  failure_reason: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Merchant, (merchant) => merchant.transactions)
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ManyToOne(() => Provider, { nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @OneToMany(() => TransactionAttempt, (attempt) => attempt.transaction)
  attempts: TransactionAttempt[];
}
