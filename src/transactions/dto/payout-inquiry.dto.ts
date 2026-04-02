import { IsInt, IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

/**
 * Query DPay payout status (Look/payment_order).
 * Provide **`transaction_id`** (recommended) or both **`merchant_order`** and **`find_date`**.
 */
export class PayoutInquiryDto {
  @ApiPropertyOptional({
    description:
      "GoldPay withdrawal transaction id. When set, order and find_date are derived for DPay.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  transaction_id?: number;

  @ApiPropertyOptional({
    description:
      "Payout order number as used with DPay (same as withdrawal order / merchant_order).",
  })
  @IsOptional()
  @IsString()
  merchant_order?: string;

  @ApiPropertyOptional({
    description: "Query time `YYYY-MM-DD HH:mm:ss` per DPay docs.",
  })
  @IsOptional()
  @IsString()
  find_date?: string;
}
