import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { Reconciliation } from './entities/reconciliation.entity';
import { ReconciliationDiscrepancy } from './entities/reconciliation-discrepancy.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { WebhookDelivery } from '../webhooks/entities/webhook-delivery.entity';
import { ProvidersModule } from '../providers/providers.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reconciliation,
      ReconciliationDiscrepancy,
      Transaction,
      WebhookDelivery,
    ]),
    ProvidersModule,
    MerchantsModule,
    WebhooksModule,
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
