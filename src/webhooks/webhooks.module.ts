import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { ProvidersModule } from '../providers/providers.module';
import { WebhookProcessor } from './processors/webhook.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookDelivery, WebhookEvent]),
    BullModule.registerQueue({
      name: 'webhook-delivery',
    }),
    forwardRef(() => TransactionsModule),
    MerchantsModule,
    ProvidersModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookProcessor],
  exports: [WebhooksService],
})
export class WebhooksModule {}
