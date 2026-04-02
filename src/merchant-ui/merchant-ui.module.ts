import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MerchantUiController } from './merchant-ui.controller';

@Module({
  imports: [ConfigModule],
  controllers: [MerchantUiController],
})
export class MerchantUiModule {}

