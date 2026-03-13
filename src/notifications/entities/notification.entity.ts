import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationRecipientType {
  ADMIN = 'admin',
  MERCHANT = 'merchant',
}

export enum NotificationCategory {
  SYSTEM = 'system',
  ACCOUNT = 'account',
  SECURITY = 'security',
  TRANSACTION = 'transaction',
  RECONCILIATION = 'reconciliation',
  WEBHOOK = 'webhook',
}

@Entity('notifications')
@Index(['recipient_type', 'admin_id', 'is_read'])
@Index(['recipient_type', 'merchant_id', 'is_read'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: NotificationRecipientType,
  })
  recipient_type: NotificationRecipientType;

  @Column({ nullable: true })
  admin_id: number;

  @Column({ nullable: true })
  merchant_id: number;

  @Column({
    type: 'enum',
    enum: NotificationCategory,
    default: NotificationCategory.SYSTEM,
  })
  category: NotificationCategory;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'datetime', nullable: true })
  read_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
