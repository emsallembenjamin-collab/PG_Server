import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VietnamBankCode } from './entities/vietnam-bank-code.entity';
import { BanksService } from './banks.service';
import { BanksController } from './banks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VietnamBankCode])],
  controllers: [BanksController],
  providers: [BanksService],
  exports: [BanksService],
})
export class BanksModule {}
