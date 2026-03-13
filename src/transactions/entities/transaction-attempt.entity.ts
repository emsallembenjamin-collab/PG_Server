import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';

export enum AttemptStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('transaction_attempts')
export class TransactionAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transaction_id: number;

  @Column({ type: 'text', nullable: true })
  provider_request: string; // JSON string

  @Column({ type: 'text', nullable: true })
  provider_response: string; // JSON string

  @Column({
    type: 'enum',
    enum: AttemptStatus,
    default: AttemptStatus.PENDING,
  })
  status: AttemptStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn()
  attempted_at: Date;

  @ManyToOne(() => Transaction, (transaction) => transaction.attempts)
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;
}
