import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("system_fee_settings")
export class SystemFeeSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 1 })
  deposit_fee_percentage: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 1 })
  withdrawal_fee_percentage: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  third_party_deposit_fee_percentage: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  third_party_withdrawal_fee_percentage: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
