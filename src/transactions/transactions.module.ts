import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { FundingController } from './funding.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { TransactionAttempt } from './entities/transaction-attempt.entity';
import { MerchantsModule } from '../merchants/merchants.module';
import { ProvidersModule } from '../providers/providers.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentProcessor } from './processors/payment.processor';
import { PublicDepositController } from './public-deposit.controller';
import { BanksModule } from '../banks/banks.module';
import { SystemFeeModule } from '../system-fee/system-fee.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, TransactionAttempt]),
    BullModule.registerQueue({
      name: 'payment-processing',
    }),
    MerchantsModule,
    BanksModule,
    ProvidersModule,
    IdempotencyModule,
    NotificationsModule,
    SystemFeeModule,
    forwardRef(() => WebhooksModule),
  ],
  controllers: [
    TransactionsController,
    FundingController,
    AdminTransactionsController,
    PublicDepositController,
  ],
  providers: [TransactionsService, PaymentProcessor],
  exports: [TransactionsService],
})
export class TransactionsModule {}
