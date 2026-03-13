import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationCategory,
  NotificationRecipientType,
} from './entities/notification.entity';
import { Admin, AdminStatus } from '../admins/entities/admin.entity';

interface NotificationPayload {
  title: string;
  message: string;
  category?: NotificationCategory;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  private serializeMetadata(metadata?: Record<string, unknown> | null) {
    if (!metadata) {
      return null;
    }

    return JSON.stringify(metadata);
  }

  async createForMerchant(
    merchantId: number,
    payload: NotificationPayload,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      recipient_type: NotificationRecipientType.MERCHANT,
      merchant_id: merchantId,
      category: payload.category ?? NotificationCategory.SYSTEM,
      title: payload.title,
      message: payload.message,
      metadata: this.serializeMetadata(payload.metadata),
    });

    return this.notificationRepository.save(notification);
  }

  async createForAdmin(
    adminId: number,
    payload: NotificationPayload,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      recipient_type: NotificationRecipientType.ADMIN,
      admin_id: adminId,
      category: payload.category ?? NotificationCategory.SYSTEM,
      title: payload.title,
      message: payload.message,
      metadata: this.serializeMetadata(payload.metadata),
    });

    return this.notificationRepository.save(notification);
  }

  async createForAllActiveAdmins(
    payload: NotificationPayload,
  ): Promise<Notification[]> {
    const admins = await this.adminRepository.find({
      where: { status: AdminStatus.ACTIVE },
      select: ['id'],
    });

    if (!admins.length) {
      return [];
    }

    const notifications = admins.map((admin) =>
      this.notificationRepository.create({
        recipient_type: NotificationRecipientType.ADMIN,
        admin_id: admin.id,
        category: payload.category ?? NotificationCategory.SYSTEM,
        title: payload.title,
        message: payload.message,
        metadata: this.serializeMetadata(payload.metadata),
      }),
    );

    return this.notificationRepository.save(notifications);
  }

  async listForAdmin(adminId: number, unreadOnly = false, limit = 20) {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.recipient_type = :type', { type: NotificationRecipientType.ADMIN })
      .andWhere('n.admin_id = :adminId', { adminId })
      .orderBy('n.created_at', 'DESC')
      .take(limit);

    if (unreadOnly) {
      qb.andWhere('n.is_read = :isRead', { isRead: false });
    }

    const [data, unreadCount] = await Promise.all([
      qb.getMany(),
      this.notificationRepository.count({
        where: {
          recipient_type: NotificationRecipientType.ADMIN,
          admin_id: adminId,
          is_read: false,
        },
      }),
    ]);

    return { data, unreadCount };
  }

  async listForMerchant(merchantId: number, unreadOnly = false, limit = 20) {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.recipient_type = :type', {
        type: NotificationRecipientType.MERCHANT,
      })
      .andWhere('n.merchant_id = :merchantId', { merchantId })
      .orderBy('n.created_at', 'DESC')
      .take(limit);

    if (unreadOnly) {
      qb.andWhere('n.is_read = :isRead', { isRead: false });
    }

    const [data, unreadCount] = await Promise.all([
      qb.getMany(),
      this.notificationRepository.count({
        where: {
          recipient_type: NotificationRecipientType.MERCHANT,
          merchant_id: merchantId,
          is_read: false,
        },
      }),
    ]);

    return { data, unreadCount };
  }

  async markReadForAdmin(adminId: number, notificationId: number) {
    const notification = await this.notificationRepository.findOne({
      where: {
        id: notificationId,
        recipient_type: NotificationRecipientType.ADMIN,
        admin_id: adminId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.is_read) {
      notification.is_read = true;
      notification.read_at = new Date();
      await this.notificationRepository.save(notification);
    }

    return notification;
  }

  async markReadForMerchant(merchantId: number, notificationId: number) {
    const notification = await this.notificationRepository.findOne({
      where: {
        id: notificationId,
        recipient_type: NotificationRecipientType.MERCHANT,
        merchant_id: merchantId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.is_read) {
      notification.is_read = true;
      notification.read_at = new Date();
      await this.notificationRepository.save(notification);
    }

    return notification;
  }

  async markAllReadForAdmin(adminId: number) {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ is_read: true, read_at: new Date() })
      .where('recipient_type = :type', { type: NotificationRecipientType.ADMIN })
      .andWhere('admin_id = :adminId', { adminId })
      .andWhere('is_read = :isRead', { isRead: false })
      .execute();

    return { updated: result.affected ?? 0 };
  }

  async markAllReadForMerchant(merchantId: number) {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ is_read: true, read_at: new Date() })
      .where('recipient_type = :type', { type: NotificationRecipientType.MERCHANT })
      .andWhere('merchant_id = :merchantId', { merchantId })
      .andWhere('is_read = :isRead', { isRead: false })
      .execute();

    return { updated: result.affected ?? 0 };
  }
}
