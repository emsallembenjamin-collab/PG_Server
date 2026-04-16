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
      third_party_deposit_fee_percentage: 0,
      third_party_withdrawal_fee_percentage: 0,
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
    if (dto.third_party_deposit_fee_percentage !== undefined) {
      settings.third_party_deposit_fee_percentage =
        dto.third_party_deposit_fee_percentage;
    }
    if (dto.third_party_withdrawal_fee_percentage !== undefined) {
      settings.third_party_withdrawal_fee_percentage =
        dto.third_party_withdrawal_fee_percentage;
    }
    return this.systemFeeRepository.save(settings);
  }

  async calculateFee(
    type: TransactionType,
    amount: number,
  ): Promise<{
    serviceFeePercentage: number;
    serviceFeeAmount: number;
    thirdPartyFeePercentage: number;
    thirdPartyFeeAmount: number;
    totalFeePercentage: number;
    totalFeeAmount: number;
    settlementAmount: number;
  }> {
    const settings = await this.ensureSettingsRow();
    const serviceFeePercentage =
      type === TransactionType.DEPOSIT
        ? Number(settings.deposit_fee_percentage || 0)
        : Number(settings.withdrawal_fee_percentage || 0);
    const thirdPartyFeePercentage =
      type === TransactionType.DEPOSIT
        ? Number(settings.third_party_deposit_fee_percentage || 0)
        : Number(settings.third_party_withdrawal_fee_percentage || 0);
    const serviceFeeAmount = roundMoney(
      (Number(amount) * serviceFeePercentage) / 100,
    );
    const thirdPartyFeeAmount = roundMoney(
      (Number(amount) * thirdPartyFeePercentage) / 100,
    );
    const totalFeePercentage = roundMoney(
      serviceFeePercentage + thirdPartyFeePercentage,
    );
    const totalFeeAmount = roundMoney(serviceFeeAmount + thirdPartyFeeAmount);
    const settlementAmount =
      type === TransactionType.DEPOSIT
        ? roundMoney(Number(amount) - totalFeeAmount)
        : roundMoney(Number(amount) + totalFeeAmount);
    return {
      serviceFeePercentage,
      serviceFeeAmount,
      thirdPartyFeePercentage,
      thirdPartyFeeAmount,
      totalFeePercentage,
      totalFeeAmount,
      settlementAmount,
    };
  }
}
