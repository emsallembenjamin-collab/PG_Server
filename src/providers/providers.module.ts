import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvidersService } from './providers.service';
import { ProvidersController } from './providers.controller';
import { Provider } from './entities/provider.entity';
import { GoldPayService } from './providers/goldpay/goldpay.service';
import { PaymentHotService } from './providers/paymenthot/paymenthot.service';
import { SandboxService } from './providers/sandbox/sandbox.service';
import { DpayService } from './providers/dpay/dpay.service';

@Module({
  imports: [TypeOrmModule.forFeature([Provider])],
  controllers: [ProvidersController],
  providers: [
    ProvidersService,
    GoldPayService,
    PaymentHotService,
    SandboxService,
    DpayService,
  ],
  exports: [ProvidersService],
})
export class ProvidersModule {}
