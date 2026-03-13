import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { Reconciliation } from './entities/reconciliation.entity';
import { ReconciliationDiscrepancy } from './entities/reconciliation-discrepancy.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { ProvidersModule } from '../providers/providers.module';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reconciliation,
      ReconciliationDiscrepancy,
      Transaction,
    ]),
    ProvidersModule,
    MerchantsModule,
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
