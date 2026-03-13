import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { TransactionAttempt } from './entities/transaction-attempt.entity';
import { MerchantsModule } from '../merchants/merchants.module';
import { ProvidersModule } from '../providers/providers.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentProcessor } from './processors/payment.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, TransactionAttempt]),
    BullModule.registerQueue({
      name: 'payment-processing',
    }),
    MerchantsModule,
    ProvidersModule,
    IdempotencyModule,
    NotificationsModule,
    forwardRef(() => WebhooksModule),
  ],
  controllers: [TransactionsController, AdminTransactionsController],
  providers: [TransactionsService, PaymentProcessor],
  exports: [TransactionsService],
})
export class TransactionsModule {}
