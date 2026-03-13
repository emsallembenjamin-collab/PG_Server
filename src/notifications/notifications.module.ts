import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MerchantsModule } from '../merchants/merchants.module';
import { Admin } from '../admins/entities/admin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Admin]), MerchantsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
