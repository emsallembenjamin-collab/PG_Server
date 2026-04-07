import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Vietnam domestic bank BIN / Napas-style codes used for DPay payout `bank_name` / metadata.
 * Reference data — not the same as DPay live `bank_list` codes; use for display and validation hints.
 */
@Entity('vietnam_bank_codes')
@Index('IDX_vietnam_bank_codes_abbreviation', ['abbreviation'])
export class VietnamBankCode {
  @PrimaryGeneratedColumn()
  id: number;

  /** e.g. 970416 — submit this as payout bank code where provider expects BIN. */
  @Column({ type: 'varchar', length: 16, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 512 })
  full_name: string;

  @Column({ type: 'varchar', length: 64 })
  abbreviation: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
