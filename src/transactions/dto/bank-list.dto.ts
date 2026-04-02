import { IsInt, Min, Max } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * DPay bank/channel resource list (CDC M): `Look` bank_list.
 * Required: `pay_type` mapping:
 * 9 banktransfer, 8 momo, 7 bankQR, 6 MomoToBank, 5 ZaloToBank, 4 VietteToBank.
 */
export class BankListDto {
  @ApiPropertyOptional({
    description:
      "DPay channel type and code. Example: 7=bankQR, 9=banktransfer, 8=momo, 6=MomoToBank, 5=ZaloToBank, 4=VietteToBank.",
    example: 7,
  })
  @IsInt()
  @Min(0)
  @Max(20)
  pay_type: number;
}

