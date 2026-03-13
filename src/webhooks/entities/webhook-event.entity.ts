import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  provider_id: number;

  @Column({ type: 'varchar', length: 100 })
  event_type: string;

  @Column({ type: 'text' })
  payload: string; // JSON string

  @Column({ type: 'varchar', length: 255, nullable: true })
  transaction_ref: string;

  @CreateDateColumn()
  received_at: Date;
}
