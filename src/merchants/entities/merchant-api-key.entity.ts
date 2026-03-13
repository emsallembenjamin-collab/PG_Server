import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Merchant } from './merchant.entity';

export enum ApiKeyStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

@Entity('merchant_api_keys')
export class MerchantApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  merchant_id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  key_hash: string; // Hashed API key

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    default: ApiKeyStatus.ACTIVE,
  })
  status: ApiKeyStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string; // Optional name for the key

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Merchant, (merchant) => merchant.api_keys)
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;
}
