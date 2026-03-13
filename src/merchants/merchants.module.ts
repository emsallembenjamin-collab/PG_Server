import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { MerchantConfigService } from './merchant-config.service';
import { Merchant } from './entities/merchant.entity';
import { MerchantApiKey } from './entities/merchant-api-key.entity';
import { MerchantConfig } from './entities/merchant-config.entity';
import { DefaultMerchantConfigPlugin } from './plugins/default-merchant-config.plugin';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Merchant, MerchantApiKey, MerchantConfig]),
    ProvidersModule,
  ],
  controllers: [MerchantsController],
  providers: [MerchantsService, MerchantConfigService, DefaultMerchantConfigPlugin],
  exports: [MerchantsService, MerchantConfigService],
})
export class MerchantsModule {
  constructor(
    private configService: MerchantConfigService,
    private defaultPlugin: DefaultMerchantConfigPlugin,
  ) {
    // Register default plugin on module initialization
    this.configService.registerPlugin(this.defaultPlugin);
  }
}
