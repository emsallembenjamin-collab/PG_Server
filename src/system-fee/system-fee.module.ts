import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemFeeSetting } from "./entities/system-fee-setting.entity";
import { SystemFeeService } from "./system-fee.service";
import { SystemFeeController } from "./system-fee.controller";

@Module({
  imports: [TypeOrmModule.forFeature([SystemFeeSetting])],
  providers: [SystemFeeService],
  controllers: [SystemFeeController],
  exports: [SystemFeeService],
})
export class SystemFeeModule {}
