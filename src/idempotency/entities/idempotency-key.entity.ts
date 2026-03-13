import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('idempotency_keys')
@Index(['merchant_id', 'key'], { unique: true })
export class IdempotencyKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  merchant_id: number;

  @Column({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  request_hash: string; // Hash of the request payload

  @Column({ type: 'text', nullable: true })
  response_payload: string; // JSON string of the response

  @CreateDateColumn()
  created_at: Date;
}
