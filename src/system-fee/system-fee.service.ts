import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TransactionType } from "../transactions/entities/transaction.entity";
import { roundMoney } from "../merchants/merchant-balance.util";
import { SystemFeeSetting } from "./entities/system-fee-setting.entity";
import { UpdateSystemFeeDto } from "./dto/update-system-fee.dto";

@Injectable()
export class SystemFeeService {
  constructor(
    @InjectRepository(SystemFeeSetting)
    private readonly systemFeeRepository: Repository<SystemFeeSetting>,
  ) {}

  private async ensureSettingsRow(): Promise<SystemFeeSetting> {
    const current = await this.systemFeeRepository.findOne({
      where: { id: 1 },
    });
    if (current) {
      return current;
    }
    const created = this.systemFeeRepository.create({
      id: 1,
      deposit_fee_percentage: 1,
      withdrawal_fee_percentage: 1,
    });
    return this.systemFeeRepository.save(created);
  }

  async getSettings(): Promise<SystemFeeSetting> {
    return this.ensureSettingsRow();
  }

  async updateSettings(dto: UpdateSystemFeeDto): Promise<SystemFeeSetting> {
    const settings = await this.ensureSettingsRow();
    if (dto.deposit_fee_percentage !== undefined) {
      settings.deposit_fee_percentage = dto.deposit_fee_percentage;
    }
    if (dto.withdrawal_fee_percentage !== undefined) {
      settings.withdrawal_fee_percentage = dto.withdrawal_fee_percentage;
    }
    return this.systemFeeRepository.save(settings);
  }

  async calculateFee(
    type: TransactionType,
    amount: number,
  ): Promise<{
    percentage: number;
    feeAmount: number;
    settlementAmount: number;
  }> {
    const settings = await this.ensureSettingsRow();
    const percentage =
      type === TransactionType.DEPOSIT
        ? Number(settings.deposit_fee_percentage || 0)
        : Number(settings.withdrawal_fee_percentage || 0);
    const feeAmount = roundMoney((Number(amount) * percentage) / 100);
    const settlementAmount =
      type === TransactionType.DEPOSIT
        ? roundMoney(Number(amount) - feeAmount)
        : roundMoney(Number(amount) + feeAmount);
    return {
      percentage,
      feeAmount,
      settlementAmount,
    };
  }
}
